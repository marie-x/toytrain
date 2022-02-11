// train.js

// TODO:
// - add velocity to each engine
// - undo/redo
// - smoke puffs
// - sounds
// - rivers
// - bridges
// - physics should use clock time not tick interval
// - half-curves and 0.707 straights
// - selected group should still have snap points
// - add track doesn't drop item under mouse
// - add track should be smarter about extending from current selection


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
    mouseDownPoint = { ...lastMouseMove } // shallow copy
    mouseDownCanvasOffset = {
        x: -canvas.viewportTransform[4],
        y: -canvas.viewportTransform[5]
    }
    renderAll('_spaceDown')
}

function onMouseMove(evt) {
    const pt = canvas.getPointer(evt.e)
    if (isNaN(pt.x) || isNaN(pt.y)) {
        return
    }
    crosshair = pt
    lastMouseMove = { x: evt.e.screenX, y: evt.e.screenY }

    $('#msg').text(js(crosshair))

    const { metaKey, shiftKey } = evt.e

    // scroll the screen around
    if (metaKey && mouseDownPoint) {
        // FIXME stinky global
        if (!shiftKey) {
            const dx = mouseDownPoint.x - lastMouseMove.x
            const dy = mouseDownPoint.y - lastMouseMove.y
            canvas.absolutePan({
                x: dx + mouseDownCanvasOffset.x,
                y: dy + mouseDownCanvasOffset.y,
            })
        } else {
            mouseDownPoint = { ...lastMouseMove }
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

function closestTrack(pt, minDist = 200) {
    let closest = null
    eachTrack(track => {
        const d = dist(track, pt)
        if (d < minDist) {
            minDist = d
            closest = track
        }
    })
    return closest
}

addVerb('addCurve', async evt => {
    const closest = closestTrack(atCrosshair(evt))
    const curve = await addWidget(evt, CURVE)
    if (closest) {
        curve.angle = angle(closest.angle + 45)
        snapItem(curve, 200)
    } else {
        log('wamp')
    }
})

addVerb('addLeft', evt => {
    return addWidget(evt, SWITCH_LEFT)
})

addVerb('addRight', evt => {
    return addWidget(evt, SWITCH_RIGHT)
})

addVerb('addStraight', async evt => {
    const closest = closestTrack(atCrosshair(evt))
    const straight = await addWidget(evt, STRAIGHT)
    if (closest) {
        straight.angle = closest.angle
        snapItem(straight, 200)
    } else {
        log('womp')
    }
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
    const selection = activeObject()
    if (selection) {
        if (selection.widget === ENGINE) {
            selection.velocity = v
            return
        }
    }
    eachEngine(engine => engine.velocity = v)
}

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
        makeDot({ fill: 'rgba(165,42,42,0.5)', ...(item.switched ? snaps[2] : snaps[1]) })
    })
    sortByLayer()
    // move trains
    const currentTick = now()
    eachEngine(engine => onMovingEngine({ engine, ticks: currentTick - lastTick }))
    lastTick = currentTick
    renderAll()
    setTimeout(tick, Math.round(1000 / 30))
}

// 1 fps
function tock() {
    // toggle switch whenever a train goes by
    eachSwitch(swatch => {
        let minDist = swatch.width, minEngine = null
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
    setTimeout(tock, 1000)
}

setTimeout(tick, Math.round(1000 / 30))
setTimeout(tock, 1000)

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