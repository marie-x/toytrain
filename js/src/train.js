// train.js

// TODO:
// - add velocity to each engine
// - undo/redo
// - smoke puffs
// - sounds
// - physics should use clock time not tick interval
// - make sure switches work
// - some sort of indication of switched/not-switched
// - some way to toggle switched/not-switched
// - selected group should still have snap points
// - add track doesn't drop item under mouse
// - add track should be smarter about extending from current selection
// - add boxcars
// - add hookup between boxcars so that they can be pulled


function onMoving(evt) {
    const active = activeObject() || activeGroup()
    if (active) {
        active.moved = true
    }
}

function onRotated(evt) {

}

const js = JSON.stringify

let crosshair
let cmdKey, shiftKey, spaceKey
let mouseDownPoint, mouseDownCanvasOffset

function metaDown() {
    canvas.defaultCursor = 'all-scroll'
    mouseDownPoint = {
        x: lastMouseMove.screenX,
        y: lastMouseMove.screenY
    }
    mouseDownCanvasOffset = {
        x: -canvas.viewportTransform[4],
        y: -canvas.viewportTransform[5]
    }
    renderAll('_spaceDown')
}

function onMouseMove(evt) {
    const pt = canvas.getPointer(evt.e)
    crosshair = lastMouseMove = pt

    $('#msg').text(js(lastMouseMove))

    // makeDot(pt)
    const { metaKey, shiftKey } = evt.e

    // scroll the screen around
    if (metaKey && mouseDownPoint) {
        const dx = mouseDownPoint.x - lastMouseMove.screenX
        const dy = mouseDownPoint.y - lastMouseMove.screenY

        // FIXME stinky global
        if (!shiftKey) {
            canvas.absolutePan({
                x: dx + mouseDownCanvasOffset.x,
                y: dy + mouseDownCanvasOffset.y,
            })
        } else {
            mouseDownPoint.x = lastMouseMove.screenX
            mouseDownPoint.y = lastMouseMove.screenY
        }
    }
    renderAll('_onMouseMove')
}

function onMouseUp(evt) {
    canvas.getObjects().forEach(target => {
        if (target.moved) {
            canvas.fire('object:moved', { target })
            delete target.moved
        }
    })
}

function onCreated(evt) {
    sortByLayer()
}

canvas.on({
    'object:moved': onMoved,
    'object:moving': onMoving,
    'object:rotated': onRotated,
    'object:created': onCreated,
    'mouse:move': onMouseMove,
    'mouse:up': onMouseUp,
})

const ENGINE = 'engine'
const TREE = 'tree'
const STRAIGHT = 'straight'
const SWITCH_LEFT = 'switch-left'
const SWITCH_RIGHT = 'switch-right'
const CURVE = 'curve'
const CROSSING = 'crossing'
const BOXCAR = 'boxcar'
const BOXCAR2 = 'boxcar2'
const CABOOSE = 'caboose'

const art = {
    [TREE]: {
        path: 'tree-f.png'
    },
    [STRAIGHT]: {
        path: 'straight-f.png'
    },
    [SWITCH_LEFT]: {
        path: 'switch-left-f.png'
    },
    [SWITCH_RIGHT]: {
        path: 'switch-right-f.png'
    },
    [CURVE]: {
        path: 'curve-f.png'
    },
    [ENGINE]: {
        path: 'engine-f.png'
    },
    [CROSSING]: {
        path: 'crossing-f.png'
    },
    [BOXCAR]: {
        path: 'car-blue-f.png'
    },
    [BOXCAR2]: {
        path: 'car-red-f.png'
    },
    [CABOOSE]: {
        path: 'caboose-f.png'
    }
}

function sortByLayer() {
    function layer(item) {
        switch (item.widget) {
            case undefined:
                return 4
            case ENGINE:
                return 3
            case BOXCAR:
            case BOXCAR2:
            case CABOOSE:
                return 2
            case CROSSING:
                return 1
            default:
                return 0
        }
    }

    // have to access the _objects directly with latest fabric
    canvas._objects.sort((a, b) => {
        return layer(a) - layer(b)
    })
}

async function addWidget(where, widget) {
    // accept an event (typically 'keydown') as a 'where', otherwise insist on fields 'top' and 'left'
    if (!where || where.left === undefined || where.top === undefined) {
        where = atCrosshair(where)
    }
    const { path, size } = art[widget]
    const img = await imageFromURL('art/' + path)
    img.widget = widget // FIXME
    img.originX = img.originY = 'center'
    // img.width = size.width
    // img.height = size.height
    img.left = where.left || 0
    img.top = where.top || 0
    rehydrate(img)
    addToCanvas(img)
    setActiveObject(img)
    return img
}

addVerb('addTree', evt => {
    return addWidget(evt, TREE)
})

addVerb('addCurve', evt => {
    return addWidget(evt, CURVE)
})

addVerb('addLeft', evt => {
    return addWidget(evt, SWITCH_LEFT)
})

addVerb('addRight', evt => {
    return addWidget(evt, SWITCH_RIGHT)
})

addVerb('addStraight', evt => {
    return addWidget(evt, STRAIGHT)
})

addVerb('addEngine', evt => {
    return addWidget(evt, ENGINE)
})

addVerb('addBoxcar', evt => {
    return addWidget(evt, BOXCAR)
})

addVerb('addBoxcar2', evt => {
    return addWidget(evt, BOXCAR2)
})

addVerb('addCaboose', evt => {
    return addWidget(evt, CABOOSE)
})

addVerb('addCrossing', evt => {
    return addWidget(evt, CROSSING)
})

addVerb('remove', (evt) => {
    evt.preventDefault()
    const items = activeObjects()
    for (const item of items) {
        canvas.remove(item)
    }
    discardActiveObject()
    return true
})

$(document).ready(async () => {
    resizeCanvas()
    await load()
    zoomToItems()
    renderAll()
})

function setVelocity(v) {
    velocity = v // FIXME individual trains
    const selection = activeObject()
    if (selection) {
        if (selection.widget === ENGINE) {
            engine.velocity = v
            return
        }
    }
    velocity = v
}

let velocity = 0.0
let { now } = Date
let lastTick = now()

// 30 fps
function tick() {
    eachObject(item => {
        if (item.type === 'circle') {
            canvas.remove(item)
        }
        delete item.marked
    })
    eachSwitch(item => {
        const snaps = snapsFor(item)
        makeDot({ fill: 'brown', ...(item.switched ? snaps[2] : snaps[1]) })
    })
    sortByLayer()
    // move trains
    const currentTick = now()
    eachEngine(engine => onMovingEngine({ engine, ticks: currentTick - lastTick }))
    lastTick = currentTick
    renderAll()
}

// 1 fps
function tock() {
    // toggle switch whenever a train goes by
    eachSwitch(swatch => {
        let minDist = swatch.height, minEngine = null
        eachEngine(engine => {
            if (dist(swatch, engine) < minDist) {
                minEngine = engine
            }
        })
        if (minEngine != swatch.minEngine) {
            if (minEngine === null) {
                swatch.switched = !swatch.switched
            }
            swatch.minEngine = minEngine
        }
    })
}

setInterval(tick, Math.round(1000 / 30))
setInterval(tock, 1000)

// why no workee waah
function addTouchHandlers(name) {
    function onTouchStart(evt) { log('1') }
    function onTouchMove(evt) { log('2') }
    function onTouchCancel(evt) { log('3') }
    function onTouchEnd(evt) { log('4') }

    // Install event handlers for the given element
    const el = document.getElementById(name)
    el.addEventListener('touchstart', onTouchStart, false)
    el.addEventListener('touchend', onTouchMove, false)
    el.addEventListener('touchcancel', onTouchCancel, false)
    el.addEventListener('touchmove', onTouchEnd, false)
}

addTouchHandlers('c3')
addTouchHandlers('c3-container')