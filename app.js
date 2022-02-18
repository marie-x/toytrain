/* eslint-disable no-sync */
/* eslint-disable no-console */
/*
 * (c) 2022 Marie Maxham.  All rights reserved.
 */
const fs = require('fs')
const express = require('express')
const forceSSL = require('express-force-ssl')
const pathlib = require('path')
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const https = require('https')
const http = require('http')
const child = require('child_process')
const MongoClient = require('mongodb').MongoClient
const passport = require('passport')
const Pushover = require('pushover-notifications')
const md5 = require('md5')
const timeout = require('connect-timeout')
const jws = require('jws')
const helmet = require('helmet')
// const sha1 = require('sha1')
const dateFormat = require('dateformat')
const flatten = require('flat')
const { constants } = require('crypto')

let userCollection = null

const app = express()
app.use(timeout(1200000)) // 20 m

require('dotenv').load()

// eslint-disable-next-line no-process-env
const { env } = process
const PORT = parseInt(env.PORT) || 3000
const HOSTNAME = env.HOSTNAME
const NODE = 'node' || env.NODE

const TMP_DIR = env.TMP_DIR || '/tmp/'
const MONGO_HOST = env.MONGO_HOST || 'localhost:27017'
const MONGO_DB_NAME = env.MONGO_DB_NAME || 'toytrain-dev'
const MONGO_URL = 'mongodb://' + MONGO_HOST + '/' + MONGO_DB_NAME

const EMAIL_PASSWORD = env.EMAIL_PASSWORD

const STRIPE_KEY = env.STRIPE_KEY || 'sk_test_dKKNcVpy2nEYlnyDITPWvCxw'

const js = JSON.stringify

function log(...args) {
    // eslint-disable-next-line no-console
    console.log([dateFormat(new Date(), 'mm-dd HH:MM:ss'), ...args].join(' '))
}

/*
const client = new MongoClient(MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true })

// Connect to the db
client.connect().then(() => {
    const db = client.db(MONGO_DB_NAME)
    log('Connected to', MONGO_URL)
    userCollection = db.collection('users')
    userCollection.find().toArray((err2, users) => {
        // log('users:', users)
        sendStartupEmail(users)
    });
    const args = process.argv.slice(2)
    if (args[0] === '--test') {
        runTests()
    }
}, (err) => {
    log('Error connecting to', MONGO_URL, err)
})
*/

const ONE_YEAR = 31536000000
app.use(helmet.hsts({
    //  maxAge: ONE_DAY,
    includeSubDomains: true,
    force: true
}))

// Redirect from http port 80 to https
http.createServer((req, res) => {
    res.writeHead(301, { 'Location': 'https://' + req.headers.host + req.url })
    res.end()
}).listen(80)

const KEY_FILE = env.KEY_FILE || 'localhost.key'
const CERT_FILE = env.CERT_FILE || 'localhost.cert'
const CA_FILE = env.CA_FILE || 'rapidssl-sha256-ca.pem'

log('create secure server on', PORT)
https.createServer({
    secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
    ca: fs.readFileSync(CA_FILE),
    honorCipherOrder: true,
    ciphers: [
        'ECDHE-RSA-AES256-SHA384',
        'DHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES256-SHA256',
        'DHE-RSA-AES256-SHA256',
        'ECDHE-RSA-AES128-SHA256',
        'DHE-RSA-AES128-SHA256',
        'HIGH',
        '!aNULL',
        '!eNULL',
        '!EXPORT',
        '!DES',
        '!RC4',
        '!MD5',
        '!PSK',
        '!SRP',
        '!CAMELLIA'
    ].join(':'),
}, app).listen(PORT)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

const maxAge = (env.MAX_AGE && !isNaN(env.MAX_AGE)) ? parseInt(env.MAX_AGE) : 0
log('max-age:', maxAge)
app.use(express.static(pathlib.join(__dirname, 'public'), {
    maxAge: maxAge,
    setHeaders: (res, path2) => {
        if (path2.includes('appcache')) {
            res.set('Content-Type', 'text/cache-manifest')
            res.set('Cache-Control', 'no-store, no-cache')
            res.set('Expires', '0')
        }
    }
}))
app.use(forceSSL)
app.use(logger('dev'))

// app.use('/', routes)
// app.use('/users', users)

// const stripe = require('stripe')(STRIPE_KEY)

//////////////////////////////

/*
const push_client = new Pushover({
    user: env.PUSHOVER_USER,
    token: env.PUSHOVER_TOKEN,
    // onerror: function(error) {},
    // update_sounds: true // update the list of sounds every day - will
    // prevent app from exiting.
})

let pushover_prior = null
let pushover_dups = 0

function pushover(level, message) {
    if (!env.PUSHOVER_TOKEN) {
        return
    }
    if (message.includes('mismatch')) {
        return
    }
    log('pushover', level, message)
    if (message === pushover_prior) {
        pushover_dups++
        return
    } else {
        pushover_dups = 0
    }
    pushover_prior = message

    let priority = 1
    if (level !== 'err') {
        priority = -2
    }
    const payload = {
        message: message,
        priority: priority,
    }
    try {
        push_client.send(payload, (err, result) => {
            if (err) {
                log('pushover fail:', err)
            }
        })
    } catch (e) {
        log('pushover exception:', e)
    }
}
*/

function _err(...msgs) {
    log('ERROR:', msgs.join(' '))
    // pushover('err', msgs.join(' '))
}

function _warn(...msgs) {
    log('WARN:', msgs.join(' '))
    // pushover('warn', msgs.join(' '))
}

//////////////////////////////

const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

passport.serializeUser((user, done) => {
    log('serializeUser', user)
    done(null, user)
})

passport.deserializeUser((obj, done) => {
    log('deserializeUser', obj)
    done(null, obj)
})

passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://127.0.0.1:3000/auth/google/callback'
},
    (accessToken, refreshToken, profile, done) => {
        log('derp:', accessToken, refreshToken, profile)
        // asynchronous verification, for effect...
        process.nextTick(() => {

            // To keep the example simple, the user's Google profile is returned to
            // represent the logged-in user.  In a typical application, you would want
            // to associate the Google account with a user record in your database,
            // and return that user instead.
            return done(null, profile)
        })
    }
))

// FIXME remove
process.on('uncaughtException', err => {
    _err('uncaught exception: ' + err)
})

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['https://www.googleapis.com/auth/drive',
            'email',
            'profile',
        ]
    }),
    (req, res) => {
        // The request will be redirected to Google for authentication, so this
        // function will not be called.
    })

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login'
    }),
    (req, res) => {
        res.redirect('/')
    })

app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
})

/*
function lookUpIP(ip) {
    if (EMAIL_PASSWORD) {
        return new Promise((resolve, reject) => {
            // TODO async
            runCmd(NODE, ['geo-ip.js', ip]).then(where => resolve(where.trim())).catch(err => reject(err))
        })
    } else {
        return new Promise((resolve, reject) => {
            resolve('8.8.8.8')
        })
    }
}

function updateIpAddress(user, ip) {
    ip = ip.replace('::ffff:', '')
    return new Promise((resolve, reject) => {
        if (user.lastIpAddress !== ip || !user.lastIpLocation) {
            log('geo-ip', ip, 'lastIpAddress', user.lastIpAddress, 'lastIpLocation', user.lastIpLocation)
            lookUpIP(ip).then(lastIpLocation => {
                if (Boolean(user.lastIpAddress) && user.lastIpAddress !== ip) {
                    if (user.lastIpLocation !== lastIpLocation) {
                        _warn(user.gmailEmail, 'went from ip', user.lastIpLocation, 'to', lastIpLocation)
                    }
                }
                updateUser(user, { lastIpAddress: ip, lastIpLocation })
                resolve(lastIpLocation)
            }, err => {
                pushErr('failed to run geo-ip.js', ip, err)
                reject(err)
            })
        } else {
            resolve()
        }
    })
}
*/

function genericPromiseFail(...args) {
    _err('app.js: genericPromiseFail:', args)
}

process.on('unhandledRejection', (reason, promise) => {
    _err('app.js: unhandledRejection: ' + reason, promise)
})

const serverVersion = fs.readFileSync('public/hash.txt')
log('ohai, you can call me', serverVersion)

/*
app.use('/version', (req, res, next) => {
    log('/version body', js(req.body))
    res.status(200)
    res.send(serverVersion)
})

app.use('/user', (req, res, next) => {
    const ip = req.ip.replace('::ffff:', '')
    log('/user body:', js(req.body), 'ip:', ip)
    getDraftyUser(req.body.gmailEmail).then(user => {
        checkSiteLicense(user)
        let userJson = js(user)
        // log('/user found:', userJson)
        updateIpAddress(user, ip).then(lastIpLocation => {
            if (lastIpLocation) {
                user = JSON.parse(userJson)
                user.lastIpLocation = lastIpLocation
                userJson = js(user)
            }
            res.status(200)
            res.send(userJson)
        }, err => {
            // in theory should never happen
            log('/user error', err, userJson)
            res.status(200)
            res.send(userJson)
        })

        const userSettings = req.body.userSettings || user.userSettings
        updateUser(user, {
            lastLogin: new Date(),
            gmailName: req.body.gmailName,
            stripeCustomerId: user.customerId,
            userSettings: userSettings,
            lastIpAddress: ip,
            draftyFolderId: user.draftyFolderId,
        })
    }, err => {
        log('/user did not find', err)
        createDraftyUser(req.body).then(user => {
            log('/user created:', js(user))
            updateUser(user, {
                lastLogin: new Date(),
                gmailName: req.body.gmailName,
                lastIpAddress: ip,
            })
            res.status(404)
            res.send(js({
                gmailName: req.body.gmailName
            }))
        }, err2 => {
            log('/user failed to create:', err2)
            res.status(500)
            res.send(js({}))
        })
    })
})
*/

function runCmd(cmd, args = []) {
    global.gc()
    const cmdLine = '/bin/bash -c "ulimit -n 8192; MAGICK_DISK_LIMIT=2GB ' + cmd + ' ' + args.join(' ') + '"'
    log(cmdLine)
    return new Promise((resolve, reject) => {
        try {
            log('running:', cmdLine)
            child.exec(cmdLine, { maxBuffer: 1024 * 2048 }, (err, stdout, stderr) => {
                if (err) {
                    _err(cmd, args, 'BZZZT', err)
                    reject(err)
                } else {
                    log('winnah!', stdout)
                    resolve(stdout)
                }
            })
        } catch (e) {
            log('blarf!', e)
            reject(e)
        }
    })
}

function runCmdSpawn(cmd, args = []) {
    log('$', cmd, args.join(' '))
    global.gc()
    return new Promise((resolve, reject) => {
        const proc = child.spawn(cmd, args)
        let output = ''

        proc.stdout.on('data', data => {
            const s = data.toString().trim()
            if (s.length < 256 && s.indexOf('WARNING') === -1) { // this is for junk DXF
                log(s)
                output += s
            }
        })

        proc.stderr.on('data', data => {
            const s = data.toString().trim()
            if (s.length < 256) {
                output += 'err>' + s
            }
        })

        proc.on('exit', code => {
            if (code === 0) {
                resolve(output)
            } else {
                reject({ code, output })
            }
        })

        proc.on('close', code => {
            if (code === 0) {
                resolve(output)
            } else {
                reject({ code, output })
            }
        })
    })
}

function btoa(s) {
    return Buffer.from(s, 'binary').toString('base64')
}

function atob(s) {
    return Buffer.from(s, 'base64').toString('binary')
}


_err('starting app on port ' + PORT)

app.post('/log', (req, res, next) => {
    try {
        // FIXME finish plumbing this
        let auth = req.headers.Authorization || req.headers.authorization
        if (auth) {
            auth = auth.replace('Bearer ', '')
            const jwt = jws.decode(auth)
            // FIXME at some point, we need to actually auth the auth
            // log('/log user:', req.user, 'auth:', auth, auth2)
        } else {
            log('/log: no auth headers found')
        }
        const body = req.body
        if (!body.email && !body.name && !body.os && !body.browser) {
            log('/log: bogus payload', js(body))
            return
        }
        let level = body.level || 'info'
        const host = body.host || '[host]'
        const email = body.email || '[email]'
        const path = body.path || '[path]'
        const name = body.name || '[name]'
        const os = body.os || '[os]'
        const verb = body.verb || '[verb]'
        const browser = body.browser || '[browser]'
        const file = body.file || '[file]'
        const version = body.version || '[version]'
        let location = (body.location || '[location]').trim()
        const sub = body.sub || ''

        function finish(where) {
            let msg = name
            if (sub) {
                msg += ' (' + sub + ')'
            }
            msg += ': ' + body.msg + ' (' + version + ', ' + verb + ', file "' + file + '" in ' + path + ' on ' + browser + '/' + os + ' from ' + where + ')'

            log(level, msg)
            // if (level !== 'info' && level !== 'debug') {
            //     try {
            //         pushoversPerUser[email] = pushoversPerUser[email] ? pushoversPerUser[email] + 1 : 1
            //         if (pushoversPerUser[email] < 50) {
            //             if (pushoversPerUser[email] === 49) {
            //                 msg = ' <b>!!CAPPED!!</b>' + msg
            //                 level = 'err'
            //             }
            //             pushover(level, msg)
            //         }
            //     } catch (e) {
            //         _err('/log push fail:', e)
            //     }
            // }
            res.status(200)
            res.send('[]')
        }

        if (location === '[unknown]' || location === '[location]') {
            const ip = req.ip.replace('::ffff:', '')
            lookUpIP(ip).then(location2 => finish(location2), () => { }) // eat failures
        } else {
            finish(location)
        }
    } catch (e) {
        _err('/log fail:', e)
        res.status(500)
    }
})


// TODO use templating engine
function tr(...tds) {
    return '<tr>' + tds.map(td => '<td>' + td + '</td>').join('') + '</tr>\n'
}

function trh(...tds) {
    return '<tr>' + tds.map(td => '<th>' + td + '</th>').join('') + '</tr>\n'
}

function sortLink(text, col2, dir2, col) {
    let arrow = ''
    col = (col || text).toLowerCase()
    let dir = 'a'
    if (col2 === col) {
        if (dir2 === 'a') {
            dir = 'd'
            arrow = '&uarr;'
        } else {
            arrow = '&darr;'
        }
    }
    return `<a href="/sekrit/site?sort=${col}&dir=${dir}">${text}${arrow}</a>`
}

function loc(user) {
    return user.lastIpLocation || ''
}

function last(user) {
    return user.lastLogin instanceof Date ? user.lastLogin.toISOString().split('T')[0] : user.lastLogin || ''
}


/////////////////////////////////////////////////////////////////////

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found')
    err.status = 404
    next(err)
})

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use((err, req, res, next) => {
        res.status(err.status || 500)
        res.render('error', {
            message: err.message,
            error: err
        })
    })
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.send({
        message: err.message,
        error: {}
    })
})

//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', (req, res) => {
    res.send('Oops! I don\'t have that file.  I notified the authorities.', 404)
});

module.exports = app

////////////////// stripe, users, etc. ///////////////////////


// FIXME janky
function formatDate(date) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'
    ]
    const dateSuffixes = [
        'th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th',
        'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th'
    ]

    return monthNames[date.getMonth()] + ' ' + date.getDate() + dateSuffixes[date.getDate() % 20]
}

//////////////// SMTP /////////////////////////

const nodemailer = require('nodemailer')

let transporter = null

if (EMAIL_PASSWORD) {
    // create reusable transporter object using SMTP transport
    transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'drafty.help@gmail.com',
            pass: EMAIL_PASSWORD,
        }
    })
}

function sendEmail(mailOptions) {
    if (transporter) {
        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return _err('sendMail', error)
            }
            log('Message sent: ' + info.response);
        })
    } else {
        log('Unable to send email -- no EMAIL_PASSWORD')
    }
}


function arrayUnion(arr1, arr2) {
    const union = arr1.concat(arr2)

    for (let i = 0; i < union.length; i++) {
        for (let j = i + 1; j < union.length; j++) {
            if (union[i] === union[j]) {
                union.splice(j, 1)
                j--
            }
        }
    }

    return union
}
