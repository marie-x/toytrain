// Copyright 2022 max
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const canvas = new fabric.Canvas('c3')
const canvasWrapper = document.getElementById('c3-container')

canvasWrapper.tabIndex = 1000

const canvasBackgroundColor = '#80b080' // pale green
const CROSSHAIR_CURSOR = 'crosshair'

canvas.allowTouchScrolling = true
canvas.defaultCursor = CROSSHAIR_CURSOR
canvas.renderOnAddRemove = false
canvas.renderOnSetActive = false
canvas.setBackgroundColor(canvasBackgroundColor)
canvas.includeDefaultValues = false
canvas.altActionKey = 'derp'
canvas.preserveObjectStacking = true

$(window).resize(() => {
    if (window.resizeTimeout) {
        clearTimeout(window.resizeTimeout)
    }
    window.resizeTimeout = setTimeout(() => {
        $(window).trigger('resizeEnd')
    }, 100)
})

let prevW, prevH

function resizeCanvas() {
    const BOTTOM_MARGIN = 250
    const RIGHT_MARGIN = 200

    const w = window.innerWidth - RIGHT_MARGIN
    const h = window.innerHeight - BOTTOM_MARGIN

    canvas.setWidth(w)
    canvas.setHeight(h)

    const dx = (w - prevW) / 2
    const dy = (h - prevH) / 2

    canvas.relativePan(new fabric.Point(dx, dy))

    prevW = w
    prevH = h

    canvas.calcOffset()
    renderAll('resizeCanvas')
}

$(window).bind('resizeEnd', () => {
    resizeCanvas()
})

function renderAll(why) {
    // log('renderAll', why)
    // if (!why) {
    //     debugger;
    // }
    canvas.requestRenderAll()
}

function discardActiveObject() {
    canvas.discardActiveObject()
}

function activeObjects() {
    return canvas.getActiveObjects()
}

function activeObject() {
    const objs = canvas.getActiveObjects()
    if (objs.length === 1) {
        return objs[0]
    }
    return undefined
}

function activeGroup() {
    const active = canvas.getActiveObject()
    const objs = canvas.getActiveObjects()
    if (objs.length > 1) {
        if (active.type === 'activeSelection') {
            return active
        }
        return {
            getObjects: () => objs,
            size: () => objs.length,
            addWithUpdate: () => active.addWithUpdate && active.addWithUpdate(),
        }
    }
    return undefined
}
