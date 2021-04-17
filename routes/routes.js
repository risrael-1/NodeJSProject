const globals = require('../globals'); //<< globals.js path
const Router = require('koa-router');
const router = new Router();
const jwt = require("jsonwebtoken");

const jwtKey = globals.JWT_KEY;
const jwtExpirySeconds = 86400 //24h * 3600(sec dans une heure)

const users = {
    user1: "password1",
    user2: "password2",
}

router.get('/singin', async (ctx) => {
    // Get credentials from JSON body
    const username = "user1";
    const password = "password1";
    if (!username || !password || users[username] !== password) {
        // return 401 error is username or password doesn't exist, or if password does
        // not match the password in our records
        ctx.throw(401, 'erreur');
    }
    // Create a new token with the username in the payload
    // and which expires 300 seconds after issue
    const token = jwt.sign({ username }, jwtKey, {
        algorithm: "HS256",
        expiresIn: jwtExpirySeconds,
    })
    // set the cookie as the token string, with a similar max age as the token
    // here, the max age is in milliseconds, so we multiply by 1000
    //ctx.cookie("token", token, { maxAge: jwtExpirySeconds * 1000 })
    //ctx.type = 'xml';
    ctx.body = token;
})

router.get('/', async (ctx) => {
    ctx.body = {
        status: 'success',
        message: 'hello, world!'
    };
})

module.exports = router;