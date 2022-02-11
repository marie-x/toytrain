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

const CENTER = {
    originX: 'center',
    originY: 'center',
    cornerSize: 6
}

const CTRLS_OFF = {
    bl: false,
    br: false,
    mb: false,
    ml: false,
    mr: false,
    mt: false,
    tl: false,
    tr: false,
    mtr: false
}

const CTRLS_WIDGET = {
    ...CTRLS_OFF,
    mtr: true
}

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

function inches(n) { return n * 3 }  // ha ha I forget why I ever did this

const STEP = inches(3)

let prevW, prevH

function resizeCanvas() {
    const BOTTOM_MARGIN = 50
    const RIGHT_MARGIN = 50

    const w = window.innerWidth - RIGHT_MARGIN
    const h = window.innerHeight - BOTTOM_MARGIN

    canvas.setWidth(w)
    canvas.setHeight(h)

    if (prevW && prevH) {
        pan((prevW - w) / 2, (prevH - h) / 2)
    }
    prevW = w
    prevH = h

    canvas.calcOffset()
    renderAll('resizeCanvas')
}

function allObjects(optionalFilter) {
    if (typeof optionalFilter === 'function') {
        return canvas.getObjects().filter(optionalFilter)
    }
    return canvas.getObjects()
}

function eachObject(fn) {
    return canvas.getObjects().forEach(fn)
}

function zoomToItems(items = canvas.getObjects()) {
    if (items.length === 0) { return }
    let minX = 100000, minY = 100000, maxX = -100000, maxY = -100000
    items.forEach(item => {
        minX = Math.min(item.left - item.width, minX)
        minY = Math.min(item.top - item.height, minY)
        maxX = Math.max(item.left + item.width, maxX)
        maxY = Math.max(item.top + item.width, maxY)
    })
    zoomToRect({ left: minX, top: minY, width: maxX - minX, height: maxY - minY })
}

$(window).bind('resizeEnd', resizeCanvas)

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

const findById = (function () {

    const _idCache = new Map()

    function _findById(id) {
        if (id) {
            const val = _idCache.get(id)
            if (val) {
                return val
            }
            const val2 = allObjects().find(item => item.id === id)
            _idCache.set(id, val2)
            return val2
        }
        return undefined
    }

    return _findById
})()


function setActiveObject(item) {
    if (typeof item === 'string') {
        item = findById(item)
    }
    item && canvas.setActiveObject(item)
    return item
}

function nextAngle(item, direction) {
    const legitRulerAngles = [0, 90, 180, 270]
    const legitLightAngles = [0, 45, 90, 135, 180, 225, 270, 315]
    const legitOtherAngles = [0, 22.5, 45, (45 + 90) / 2, 90, (90 + 135) / 2, 135,
        (135 + 180) / 2, 180, (180 + 225) / 2, 225, (225 + 270 / 2), 270, (270 + 315) / 2, 315, (315 + 360) / 2]

    let legitAngles = legitOtherAngles
    // if (item.isUnit() || item.isPipe()) {
    //     legitAngles = legitLightAngles
    // } else if (item.isRuler()) {
    //     legitAngles = legitRulerAngles
    // }
    const currentAngle = Math.round(item.angle + 360) % 360
    const i = legitAngles.indexOf(currentAngle)
    const ii = (i + direction + legitAngles.length) % legitAngles.length
    return legitAngles[ii]
}

function rotate(active, direction) {
    if (active.type === 'activeSelection') {
        for (const item of active.getObjects()) {
            rotateTo(item, nextAngle(item, direction))
        }
        active.addWithUpdate()
    } else {
        rotateTo(active, nextAngle(active, direction))
    }
    // objectModified('_rotate')
}

// FIXME move this someplace better
function rotateTo(item, theta) {
    // if group, rotate individual elements
    if (item.type === 'activeSelection') {
        item.getObjects().map(obj => rotateTo(obj, theta - item.angle))
        return
    }
    // if (item.isLocked()) {
    //     return
    // }
    const originalAngle = item.angle

    item.angle = theta
    if (item.widget && item.getObjects) {
        // back-rotate text so that it's always horizontal
        // FIXME uncertain about singling out DIMS_T
        // FIXME scenic is also gross
        item.getObjects().forEach(obj => {
            if (obj.type === TEXT_T || obj.type === POLYGON_T || (item.isLight() && obj.type === 'rect')) {
                obj.angle = -theta + parent
            }
        })
    }

    let da = theta - originalAngle // change in angle
    if (da) {
        canvas.fire('object:rotated', { target: item, delta: da })
    }

    onMoved(item)
    renderAll()
}

function onMoved(item) {
    sortByLayer()
    save()
}

// copes with things belonging in groups
function globalCenter(item, left = 'x', top = 'y') {
    if (!item.hasOwnProperty('left') && !item.hasOwnProperty('top')) {
        left = 'left'
        top = 'top'
    }
    const cc = {}
    if (!item.getCenterPoint) {
        cc[left] = item.left
        cc[top] = item.top
    } else {
        const c = item.getCenterPoint()
        if (item.group) {
            const gc = item.group.getCenterPoint()
            const ga = item.group.angle * DEG
            const cx = c.x
            const cy = c.y
            c.x = gc.x + cx * Math.cos(ga) - cy * Math.sin(ga)
            c.y = gc.y + cy * Math.cos(ga) + cx * Math.sin(ga)
        }
        cc[left] = c.x
        cc[top] = c.y
    }
    for (const [key, val] of Object.entries(cc)) {
        if (isNaN(val)) {
            debugger;
        }
    }
    return cc
}


function move(active, dx, dy) {
    if (active.type === 'activeSelection') {
        moveTo(active, active.left + dx, active.top + dy)
        for (const item of active.getObjects()) {
            item.drag = globalCenter(item)
            // _parentMoved(item, dx, dy)
        }
    } else {
        active.drag = globalCenter(active)
        // FIXME why are the 'round' calls here?
        moveTo(active, Math.round(active.left + dx), Math.round(active.top + dy))
        // _itemMoved(active)
    }

    // re-render immediately instead of delayed
    // because we're interactive
    renderAll('_move')
    onMoved(active)
    // objectModified('_move')
}

function pan(dx, dy) {
    canvas.relativePan(new fabric.Point(-dx, -dy))
    renderAll('pan')
}

function atCrosshair(evt) {
    if (evt && evt.top !== undefined && evt.left !== undefined) {
        return {
            left: evt.left,
            top: evt.top,
        }
    }
    if (evt && evt.keyCode) {
        return {
            // be defensive
            left: crosshair.x || 0,
            top: crosshair.y || 0,
        }
    } else {
        // centered on current viewport
        const { topLeft, topRight, bottomLeft } = canvasBoundaries()
        return {
            left: (topLeft.x + topRight.x) / 2,
            top: (topLeft.y + bottomLeft.y) / 2,
        }
    }
}

function canvasBoundaries() {
    const topLeftCanvas = {
        x: 0,
        y: 0
    }
    const topRightCanvas = {
        x: canvas.width,
        y: 0
    }
    const bottomLeftCanvas = {
        x: 0,
        y: canvas.height
    }

    const inverse = fabric.util.invertTransform(canvas.viewportTransform)
    const topLeft = fabric.util.transformPoint(topLeftCanvas, inverse)
    const topRight = fabric.util.transformPoint(topRightCanvas, inverse)
    const bottomLeft = fabric.util.transformPoint(bottomLeftCanvas, inverse)

    return { topLeft, topRight, bottomLeft }
}

const BLACK = '#000000'

// promise version rather than callback
async function imageFromURL(url, stroke) {
    if (stroke === BLACK || stroke === undefined) {
        return new Promise((resolve, reject) => {
            try {
                fabric.Image.fromURL(url, img => {
                    if (img && img.getElement()) {
                        resolve(img)
                    } else {
                        reject(new Error('imageFromURL null ' + url))
                    }
                })
            } catch (err) {
                reject(err)
            }
        })
    } else {
        // NOT IMPLEMENTED IN TRAIN LAND YET - all pixel art so far, no SVGs
        // colorize
        return new Promise((resolve, reject) => {
            fabric.loadSVGFromURL(url, (objects, options) => {
                // apply the stroke color to the SVG
                for (const path of objects) {
                    if (path.id) {
                        // FIXME not sure how this contaminates the SVGs but oy
                        warn(url, 'has an id of', path.id)
                        delete path.id
                    }
                    if (path.stroke) {
                        path.stroke = stroke || path.stroke
                    }
                }
                const img = fabric.util.groupSVGElements(objects, options, url, true)
                img.srcPath = url
                img.stroke = stroke
                // img.src = url
                resolve(img)
            })
        })
    }
}

function makeGuid() {
    let d = new Date().getTime()
    return 'xxxxxxxx'.replace(/[x]/g, (c) => {
        const r = (d + Math.random() * 16) % 16 | 0
        d = Math.floor(d / 16)
        return r.toString(16)
    })
}

function isNum(n) {
    return typeof n === 'number' && !isNaN(n)
}

function addToCanvas(item, skipSelect) {
    let madeGuid = false
    if (!item.id) {
        item.id = makeGuid()
        madeGuid = true
    }
    if (!isNum(item.left) || !isNum(item.top)) {
        error('trying to add', desc4(item), 'with bogus left/top', item.left, item.top)
        // FIXME consider deleting or something
    }
    canvas.add(item)
    if (item.evented) {
        setActiveObject(item)
    }
    // _idCache[item.id] = item
    canvas.fire('object:created', { target: item })
    renderAll()
    return item
}

function showZoom() {
    // TODO
}

function zoomToRect(rect, ratio) {
    if (ratio === undefined) {
        const rw = canvas.width / rect.width
        const rh = canvas.height / rect.height
        ratio = Math.min(rw, rh) * 0.95
    }
    const center = new fabric.Point(rect.left, rect.top)
    if (rect.originX !== 'center') {
        center.x += rect.width / 2
    }
    if (rect.originY !== 'center') {
        center.y += rect.height / 2
    }
    canvas.zoomToPoint(center, ratio)
    const panX = -canvas.width * 0.5 + ratio * center.x
    const panY = -canvas.height * 0.5 + ratio * center.y
    canvas.absolutePan(new fabric.Point(panX, panY))
    renderAll('_zoomToRect')
}

function makeDot(params) {
    return canvas.add(new fabric.Circle({
        left: params.x || 0,
        top: params.y || 0,
        fill: 'red',
        radius: 5,
        originX: 'center',
        originY: 'center',
        ...params
    }))
}

$(document).ready(() => {
    addVerb('zoomIn', evt => {
        const group = activeGroup() || activeObject()
        if (group) {
            zoomToRect(group, canvas.getZoom() * 1.1)
        } else {
            canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() * 1.1)
            allObjects(obj => obj.setCoords())
        }
        showZoom()
        renderAll('zoomIn')
    })

    addVerb('zoomOut', evt => {
        canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() / 1.1)
        allObjects(obj => obj.setCoords())
        showZoom()
        renderAll('zoomIn')
    })
})

function onMouseWheel(evt) {
    const target = canvas.findTarget(evt)
    let delta = -evt.originalEvent.wheelDelta / 120
    if (isNaN(delta)) {
        // fuck you FireFox
        evt = evt.originalEvent
        delta = evt.detail / 12
    }
    if (Math.abs(delta) < 0.001) {
        return
    }
    const pt = canvas.getPointer(evt)

    let factor
    if (delta < 1) {
        factor = 1 - delta / 2
    } else {
        factor = 1 / (1 + delta / 2)
    }

    const newZoom = Math.min(25, Math.max(0.03, canvas.getZoom() * factor))
    // log('zoom', newZoom)
    canvas.zoomToPoint(new fabric.Point(evt.offsetX, evt.offsetY), newZoom)
    showZoom()

    // recalc coords after zoom to prevent offscreen bugs
    // TODO figure out if we can limit to only at-risk items
    canvas.getObjects().forEach(item => item.visible && item.setCoords())

    renderAll('_onMouseWheel')
    evt.preventDefault()
}

$(canvas.wrapperEl).on('mousewheel DOMMouseScroll', onMouseWheel)
