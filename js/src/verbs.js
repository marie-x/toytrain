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

const verbs = {}

const doNotSaveVerbs = {
    zoomIn: true,
    zoomOut: true,
    shiftUp: true,
    shiftDown: true,
    altUp: true,
    altDown: true,
    cmdUp: true,
    cmdDown: true,
    spaceUp: true,
    spaceDown: true,
}

const verbExceptions = {
    'addPlasterLineMarker': true,
    'addCenterLineMarker': true,
    'unsubscribe': true,
    'setTitleVis': true,
    'confirmUnsubscribe': true,
}

function addVerb(verbName, verbMethod, replace) {
    if (typeof verbName == 'function') {
        error('cannot add verb "' + verbName.name + '"; it won\'t survive minification')
        return
    }
    if (verbs[verbName] && !replace) {
        error('cannot add redundant verb: "' + verbName + '"')
    } else {
        verbs[verbName] = verbMethod
    }
}

let lastVerb

function tryVerb(verb, evt, silent) {
    // FIXME eventually get rid of reference to 'window'
    if (typeof window[verb] === 'function' && !verbExceptions[verb] && !verbs[verb]) {
        warn('* consider module-motizing', verb)
    }
    const verbMethod = verbs[verb] || window[verb]
    if (typeof verbMethod === 'function') {
        $('body').addClass('waiting') // FIXME I don't think this ever worked
        let result = null
        try {
            lastVerb = verb
            // actionPush(verb)
            result = verbMethod(evt)
        } catch (e) {
            error('fail during', verb, e.message, e.stack)
        }
        if (result && typeof result.then === 'function') {
            // don't save if it was a result, because it's got async stuff to do
            result.then(result2 => {
                if (!doNotSaveVerbs[verb] && Boolean(result2)) {
                    save('verb*:' + verb)
                }
            })
        } else if (!doNotSaveVerbs[verb] && (result === undefined || Boolean(result))) {
            // verbs should return true/false as to whether saving is merited.
            // but for those that don't return anything, better to save than not
            save('verb:' + verb + ' result:' + result)
        }
        renderAll('tryVerb')
        $('body').removeClass('waiting')
        return result
    }
    if (!silent) {
        error(verb, 'is not a recognized verb')
    }
    return undefined
}

// handler for all 'verb'-class buttons
$('.verb').click(evt => {
    let verb = $(evt.currentTarget).attr('action') || evt.currentTarget.id
    const mods = metaName(evt)
    if (mods) {
        verb = $(evt.currentTarget).attr(mods + 'Action') || verb
    }
    log('verb', verb, 'mods', mods)
    tryVerb(verb, evt)
})
