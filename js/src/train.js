// train.js

function onMoving(evt) {

}

function onRotated(evt) {

}

canvas.on({
    'object:moving': onMoving,
    'object:rotated': onRotated,
})

resizeCanvas()
renderAll()