// train.js

// TODO:
// - add engine
// - speed/slow engine movement
// - snap engine to track
// - undo/redo
// - smoke puffs
// - sounds
// - snap track to track
// - engine always on top
// - zoom to extent on load

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
    }
}

function sortByLayer() {
    function layer(item) {
        switch (item.widget) {
            case ENGINE:
                return 0
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

let velocity = 0.1

function tick() {
    // move trains
    canvas.getObjects().filter(item => item.widget === ENGINE).forEach(engine => {
        // move engine
        engine.top += velocity * Math.sin(Math.PI * engine.angle / 180)
        engine.left += velocity * Math.cos(Math.PI * engine.angle / 180)
        engine.setCoords()
    })
    renderAll()
}

setInterval(tick, Math.round(1000 / 30))