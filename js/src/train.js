// train.js

// TODO:
// - undo/redo
// - sounds
// - rivers
// - moar trees
// - bridges
// - Y-switches
// - trains should be able to go backwards
// - physics should use clock time not tick interval
// - selected group should still have snap points
// - selected group should not lose its global position info
// - overtaking train should not steal cars :)

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

    $('#msg').text(`(${Math.round(crosshair.x)}, ${Math.round(crosshair.y)})`)
    let sel = ''
    let aa = null
    if (aa = activeObject()) {
        sel = ` ${aa.widget} (${Math.round(aa.left)}, ${Math.round(aa.top)}, ${Math.round(aa.angle)}º)`
    }
    $('#sel').text(sel)
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

let ii = null // global for debug

function onSelection(evt) {
    const { selected } = evt
    ii = selected[0]
    log('selected', ii.widget, ii.id)
}

function onDeselection(evt) {
    ii = null
}

canvas.on({
    'object:moved': onMoved,
    'object:moving': onMoving,
    'object:rotated': onRotated,
    'object:created': onCreated,
    'selection:created': onSelection,
    'selection:updated': onSelection,
    'selection:cleared': onDeselection,
    'mouse:move': onMouseMove,
    'mouse:up': onMouseUp,
})

const PUFF = 'puff' // not an image, is a collection of circles

const ENGINE = 'engine'
const TREE = 'tree'
const STRAIGHT = 'straight'
const STRAIGHT2 = 'straight2'
const SWITCH_LEFT = 'switch-left'
const SWITCH_RIGHT = 'switch-right'
const CURVE = 'curve'
const CURVE2 = 'curve2'
const CROSSING = 'crossing'
const BOXCAR = 'boxcar'
const BOXCAR2 = 'boxcar2'
const CABOOSE = 'caboose'
const ENDPOINT = 'endpoint'

const art = {
    [TREE]: {
        path: 'tree-f.png'
    },
    [STRAIGHT]: {
        path: 'straight-f.png'
    },
    [STRAIGHT2]: {
        path: 'straight-2-f.png'
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
    [CURVE2]: {
        path: 'curve2-f.png'
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
    },
    [ENDPOINT]: {
        path: 'endpoint-f.png'
    }
}

function capitalize(s) {
    return s.slice(0, 1).toUpperCase() + s.slice(1)
}

function metaName(evt) {
    const keys = []
    evt.metaKey && keys.push('Cmd')
    evt.ctrlKey && !keys.includes('Cmd') && keys.push('Cmd')
    evt.altKey && keys.push('Alt')
    evt.shiftKey && keys.push('Shift')
    const s = keys.join('')
    if (s.length) {
        return s[0].toLowerCase() + s.slice(1)
    }
    return ''
}

$(document).ready(() => {
    Object.keys(art).sort().forEach(key => {
        // replace is for -left and -right
        const verb = ('add' + capitalize(key)).replace('-l', 'L').replace('-r', 'R')
        $('#buttons').append($(`<button class="verb" id="${verb}">${key}</button>`))
    })

    $('.verb').click(evt => {
        let verb = $(evt.currentTarget).attr('action') || evt.currentTarget.id
        const mods = metaName(evt)
        if (mods) {
            verb = $(evt.currentTarget).attr(mods + 'Action') || verb
        }
        log('verb', verb, 'mods', mods)
        tryVerb(verb, evt)
    })

})
function sortByLayer() {
    function layer(item) {
        switch (item.widget) {
            case undefined:
                return 100
            case PUFF:
                return 4 // above engine but below bridges
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
    }
})

addVerb('addCurve2', async evt => {
    const closest = closestTrack(atCrosshair(evt))
    const curve = await addWidget(evt, CURVE2)
    if (closest) {
        curve.angle = angle(closest.angle + 45) // FIXME get smarter?
        snapItem(curve, 200)
    }
})

addVerb('addLeft', evt => {
    return addWidget(evt, SWITCH_LEFT)
})

addVerb('addRight', evt => {
    return addWidget(evt, SWITCH_RIGHT)
})

addVerb('duplicate', async evt => {
    const active = activeObject()
    if (active && active.widget) {
        const clone = await addWidget(evt, active.widget)
        clone.angle = active.angle
        return clone
    }
    return null
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

addVerb('addStraight2', async evt => {
    const closest = closestTrack(atCrosshair(evt))
    const straight = await addWidget(evt, STRAIGHT2)
    if (closest) {
        straight.angle = closest.angle
        snapItem(straight, 200)
    } else {
        log('womp')
    }
})

addVerb('addEndpoint', async evt => {
    const closest = closestTrack(atCrosshair(evt))
    const straight = await addWidget(evt, ENDPOINT)
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

function addPuff(engine) {
    const elements = Array(20).fill().map((v, i) => {
        return new fabric.Circle({
            fill: 'white',
            radius: 7,
            originX: 'center',
            originY: 'center',
            left: Math.random() * 20 - 10,
            top: Math.random() * 20 - 10,
            opacity: 0.5 + 0.4 * Math.random()
        })
    })
    const puff = new fabric.Group(elements, {
        left: engine.left + 10 * cos(engine.angle),
        top: engine.top + 10 * sin(engine.angle),
        width: 50,
        height: 50,
        widget: PUFF,
        ticks: 200,
        selectable: false,
        originX: 'center',
        originY: 'center'
    })
    addToCanvas(puff, false)
}

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
    eachObject(item => {
        if (item.widget === PUFF) {
            item.getObjects().forEach(dot => {
                dot.fill = `rgba(255,255,255,${dot.opacity})`
                // log(dot.opacity)
                dot.opacity *= 0.995
                dot.dirty = true
            })
            item.dirty = true
        }
        if (--item.ticks === 0) {
            canvas.remove(item)
        }
    })
    let active = activeObject()
    if (active && active.widget === ENGINE) {
        if (!active.isOnScreen()) {
            const { tr, tl, br } = canvas.vptCoords
            const width = tr.x - tl.x
            const height = br.y - tr.y
            zoomToRect({ left: active.left - width / 2, top: active.top - height / 2, width, height })
        }
    }
    renderAll()
    setTimeout(tick, Math.round(1000 / 30))
}

// 2 fps
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

    eachEngine(engine => {
        if (engine.velocity) {
            addPuff(engine)
        }
    })

    setTimeout(tock, 1000)
}

$(document).ready(async () => {
    resizeCanvas()
    await load()
    zoomToItems()
    renderAll()
    setTimeout(tick, Math.round(1000 / 30))
    setTimeout(tock, 1000)
})

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