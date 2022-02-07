// train.js

// TODO:
// - add engine
// - speed/slow engine movement
// - snap engine to track
// - undo/redo
// - smoke puffs
// - sounds
// - snap track to track
// - zoom in/out

function onMoving(evt) {

}

function onRotated(evt) {

}

let crosshair
let cmdKey, shiftKey, spaceKey

function onMouseMove(evt) {
    lastMouseMove = evt
    crosshair = evt.pointer

    // FIXME
    cmdKey = evt.metaKey
    shiftKey = evt.shiftKey

    // scroll the screen around
    if (spaceKey && mouseDownPoint) {
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
        renderAll('_onMouseMove')
    }
    renderAll('_onMouseMove')
}

canvas.on({
    'object:moving': onMoving,
    'object:rotated': onRotated,
    'mouse:move': onMouseMove,
})

const art = {
    tree: {
        path: 'tree-f.png', size: { width: 113, height: 104 }
    },
    straight: {
        path: 'straight-f.png'
    },
    left: {
        path: 'switch-left-f.png'
    },
    right: {
        path: 'switch-right-f.png'
    },
    curve: {
        path: 'curve-f.png'
    },
    engine: {
        path: 'engine-f.png'
    }
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
}

addVerb('addTree', evt => {
    return addWidget(evt, 'tree')
})

addVerb('addCurve', evt => {
    return addWidget(evt, 'curve')
})

addVerb('addLeft', evt => {
    return addWidget(evt, 'left')
})

addVerb('addRight', evt => {
    return addWidget(evt, 'right')
})

addVerb('addStraight', evt => {
    return addWidget(evt, 'straight')
})

addVerb('addEngine', evt => {
    return addWidget(evt, 'engine')
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

load()
resizeCanvas()
renderAll()

let velocity = 0.1

function tick() {
    // move trains
    canvas.getObjects().filter(item => item.widget === 'engine').forEach(engine => {
        // move engine
        engine.top += velocity * Math.sin(Math.PI * engine.angle / 180)
        engine.left += velocity * Math.cos(Math.PI * engine.angle / 180)
        engine.setCoords()
    })
    renderAll()
}

setInterval(tick, Math.round(1000 / 30))