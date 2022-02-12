// train.js

// TODO:
// - undo/redo
// - sounds
// - rivers
// - moar trees
// - bridges
// - Y-switches
// - boids??
// - svg clouds
// - trains should be able to go backwards
// - physics should use clock time not tick interval
// - selected group should still have snap points
// - selected group should not lose its global position info
// - load/store gdrive
// - why do clouds go nuts when i switch away from the tab?

function onMoving(evt) {
    const active = activeObject() || activeGroup()
    if (active) {
        active.moved = true
        decouple(active)
    }
}

function decouple(car) {
    // dragged car -> disconnect in both directions if possible
    if (!car) {
        return
    }
    if (car.following) {
        const followed = findById(car.following)
        if (followed) {
            delete followed.pulling
        }
        delete car.following
    }
    if (car.pulling) {
        const pulled = findById(car.pulling)
        if (pulled) {
            delete pulled.following
        }
        delete car.pulling
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
    renderAll('metaDown')
}

let lastMouseMove = { x: 0, y: 0 }

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
    allObjects().forEach(target => {
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
const TREE2 = 'tree2'
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
    [TREE2]: {
        path: 'tree-2-f.png'
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
                return 3 // + ((item.numCars || 0) / 1000) // shorter trains to the front of the line
            case BOXCAR:
            case BOXCAR2:
                return 2
            case CABOOSE:
                return 1.9 // maybe this will skoot them to the back?
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
    img.left = where.left || 0 // maybe center of canvas viewport would be better
    img.top = where.top || 0
    rehydrate(img)
    addToCanvas(img)
    setActiveObject(img)
    return img
}

addVerb('addTree', evt => {
    return addWidget(evt, TREE)
})

addVerb('addTree2', evt => {
    return addWidget(evt, TREE2)
})

function closestTrack(pt, minDist = 200) {
    let closest = null
    eachTrack(track => {
        const d = dist(track, pt)
        if (d < minDist && d > 0) {
            minDist = d
            closest = track
        }
    })
    return closest
}

function snapClosest(track, theta = 0) {
    const closest = closestTrack(track)
    if (closest) {
        track.angle = wrap(closest.angle + theta)
        snapItem(track, 200)
    }
    return track
}

addVerb('addCurve', async evt => {
    return snapClosest(await addWidget(evt, CURVE), 45)
})

addVerb('addCurve2', async evt => {
    return snapClosest(await addWidget(evt, CURVE), 45)
})

addVerb('addSwitchLeft', async evt => {
    return snapClosest(await addWidget(evt, SWITCH_LEFT))
})

addVerb('addSwitchRight', async evt => {
    // TODO snap?
    return snapClosest(await addWidget(evt, SWITCH_RIGHT))
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
    return snapClosest(await addWidget(evt, STRAIGHT))
})

addVerb('addStraight2', async evt => {
    return snapClosest(await addWidget(evt, STRAIGHT2))
})

addVerb('addEndpoint', async evt => {
    return snapClosest(await addWidget(evt, ENDPOINT))
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
    // bunch of little circles randomly arrayed in polar coords
    const elements = Array(20).fill().map((v, i) => {
        let r = 2 + 10 * Math.random()
        let theta = 360 * Math.random()
        return new fabric.Circle({
            fill: 'white',
            radius: 7,
            left: r * cos(theta),
            top: r * sin(theta),
            opacity: 0.5 + 0.4 * Math.random(),
            ...CENTER
        })
    })
    const puff = new fabric.Group(elements, {
        left: engine.left + 10 * cos(engine.angle),
        top: engine.top + 10 * sin(engine.angle),
        width: 50,
        height: 50,
        widget: PUFF,
        selectable: false,
        evented: false,
        ...CENTER
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

// todo use clock
function fadePuffs() {
    eachObject(item => {
        if (item.widget === PUFF) {
            let maxOpacity = 0
            item.getObjects().forEach(dot => {
                dot.fill = `rgba(255,255,255,${dot.opacity})`
                dot.opacity *= 0.98
                maxOpacity = Math.max(dot.opacity, maxOpacity)
                dot.dirty = true
            })
            item.dirty = true
            if (maxOpacity < 0.05) {
                canvas.remove(item)
            }
        }
    })
}

function closestCar(car, radius) {
    let minCar = null, minDist = radius
    eachCar(item => {
        const d = dist(car, item)
        if (d < minDist && d > 0 && angleDiff(car.angle, item.angle) <= 45) {
            minCar = item
            minDist = d
        }
    })

    return minCar
}

function closestFreeCar(pt, radius) {
    // look at all cars, find one 180º behind me
    let minCar = null, minDist = radius
    eachCar(item => {
        if (!item.following) {
            const d = dist(item, pt)
            // don't follow yourself
            if (d < minDist && d > 0 && angleDiff(pt.angle, item.angle) <= 45) {
                minCar = item
                minDist = d
            }
        }
    })

    return minCar
}

// just straight lines at first FIXME
function onMovingEngine(evt) {

    // TODO use ticks
    const { engine, ticks } = evt
    let velocity = engine.velocity || 0

    if (velocity === 0) { return }

    // pulling cars slows you down a little
    const numCars = engine.numCars || 0
    velocity -= numCars / 10

    const closest = closestCar(engine, engine.width)
    if (closest && closest.following !== engine.id) {
        // log('whoah')
        velocity /= 2
    }

    let trail = engine.trail = engine.trail || []
    trail.push({ x: engine.left, y: engine.top, angle: engine.angle, id: engine.id })
    while (dist(engine, trail[0]) > engine.width) {
        trail.shift()
    }

    engine.left += velocity * cos(engine.angle)
    engine.top += velocity * sin(engine.angle)

    let { minPt, minAngle } = getTrackSnap(engine)
    if (minPt && minPt.u >= 0 && minPt.u <= 1) {
        if (angleDiff(engine.angle, minAngle) > 12) {
            log('bad snap', minPt, minAngle, engine.angle)
            getTrackSnap(engine, 'debug')
        }
        engine.left = minPt.x
        engine.top = minPt.y
        engine.angle = minAngle
        engine.setCoords()
    }

    // find a trail of boxcars and caboooooses
    let leadCar = engine
    engine.numCars = 0
    let { width } = leadCar
    let sixOClock = trail[0]
    // makeDot({ left: sixOClock.x, top: sixOClock.y })
    let tailCar = findById(leadCar.pulling) || closestFreeCar(sixOClock, width)
    while (tailCar) {
        // put car on my ant trail
        leadCar.pulling = tailCar.id
        tailCar.following = leadCar.id
        tailCar.left = sixOClock.x
        tailCar.top = sixOClock.y
        tailCar.angle = sixOClock.angle
        tailCar.setCoords()
        tailCar.marked = true // FIXME gross
        engine.numCars++

        // next
        leadCar = tailCar
        width = leadCar.width
        trail = leadCar.trail = leadCar.trail || []
        trail.push({ x: leadCar.left, y: leadCar.top, angle: leadCar.angle, id: leadCar.id })
        while (dist(leadCar, trail[0]) > engine.width) {
            trail.shift()
        }
        sixOClock = trail[0]
        // log(sixOClock, width)
        // makeDot({ left: sixOClock.x, top: sixOClock.y })
        tailCar = findById(tailCar.pulling) || closestFreeCar(sixOClock, width)
    }
}

let { now } = Date
let lastTick = now()

// 30 fps
function tick() {
    eachObject(item => {
        if (item.type === 'circle') {
            canvas.remove(item)
        }
        delete item.marked // TODO FIXME
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
    fadePuffs()
    let active = activeObject()
    if (active && active.widget === ENGINE) {
        if (!active.isOnScreen()) {
            centerViewportOn(active)
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

    setTimeout(tock, 500)
}

$(document).ready(async () => {
    resizeCanvas()
    await load()
    zoomToItems()
    renderAll()
    setTimeout(tick, Math.round(1000 / 30))
    setTimeout(tock, 500)
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