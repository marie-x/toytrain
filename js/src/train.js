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
    lastMouseMove = evt.e
    crosshair = evt.pointer
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

let velocity = 0.0


function tick() {
    sortByLayer()
    // move trains
    canvas.getObjects().filter(item => item.widget === ENGINE).forEach(engine => {
        // move engine
        // snap
        // get the closest arc or segment
        onMovingEngine({ target: engine })
        engine.setCoords()
    })
    renderAll()
}

setInterval(tick, Math.round(1000 / 30))