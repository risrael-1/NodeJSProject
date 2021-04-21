const globals = require("../globals"); //<< globals.js path
const Router = require("koa-router");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const MongoClient = require("mongodb").MongoClient;
const { ObjectID } = require("bson");

const functions = require("../functions")

const router = new Router();
const uri = globals.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const jwtKey = globals.JWT_KEY;
const jwtExpirySeconds = 86400; //24h * 3600(sec dans une heure)

router.post("/signin", async (ctx) => {
  ctx.type = "json";
  ctx.status = 400;
  let req = JSON.stringify(ctx.request.body);
  let res = JSON.parse(req);
  if (!res.name || !res.password) {
    ctx.body = JSON.parse('{"error" : "null"}');
  } else if (res.password.length < 4) {
    ctx.body = JSON.parse(
      '{"error" : "Le mot de passe doit contenir au moins 4 caractères"}'
    );
  } else if (res.name.length < 2 || res.name.length > 20) {
    ctx.body = JSON.parse(
      '{"error" : "Votre identifiant doit contenir entre 2 et 20 caractères"}'
    );
  } else if (!/^[a-z]+$/.test(res.name)) {
    ctx.body = JSON.parse(
      '{"error" : "Votre identifiant ne doit contenir que des lettres minuscules non accentuées"}'
    );
  } else {
    await client.connect();
    const collection = client.db("notes-api").collection("users");
    let tempName = await collection.findOne({
      username: res.name,
    });
    if (tempName != null) {
      if (await bcrypt.compare(res.password, tempName.password)) {
        ctx.status = 200;
        const username = res.name;
        let options = {
          httpOnly: true,
          overwrite: true,
          sameSite: true,
          maxAge: 1000 * 60 * 60 * 24, // would expire after 24 hours
        };
        const token = jwt.sign({ username }, jwtKey, {
          algorithm: "HS256",
          expiresIn: jwtExpirySeconds,
        });
        ctx.cookies.set("x-access-token", token, options);
        ctx.body = { token };
      } else {
        ctx.body = JSON.parse('{"error" : "null"}');
      }
    } else {
      ctx.status = 403;
      ctx.body = JSON.parse('{"error" : "Cet identifiant est inconnu"}');
    }
  }
});

router.post("/signup", async (ctx) => {
  ctx.type = "json";
  ctx.status = 400;
  let req = JSON.stringify(ctx.request.body);
  let res = JSON.parse(req);
  if (!res.name || !res.password) {
    ctx.body = JSON.parse('{"error" : "null"}');
  } else if (res.password.length < 4) {
    ctx.body = JSON.parse(
      '{"error" : "Le mot de passe doit contenir au moins 4 caractères"}'
    );
  } else if (res.name.length < 2 || res.name.length > 20) {
    ctx.body = JSON.parse(
      '{"error" : "Votre identifiant doit contenir entre 2 et 20 caractères"}'
    );
  } else if (!/^[a-z]+$/.test(res.name)) {
    ctx.body = JSON.parse(
      '{"error" : "Votre identifiant ne doit contenir que des lettres minuscules non accentuées"}'
    );
  } else {
    await client.connect();
    const collection = client.db("notes-api").collection("users");
    let tempName = await collection.findOne({
      username: res.name,
    });
    if (tempName == null) {
      let salt = await bcrypt.genSalt(10);
      let hash = await bcrypt.hashSync(res.password, salt);
      console.log(hash);
      let insertUser = await collection.insertOne({
        username: res.name,
        password: hash,
      });
      ctx.status = 200;
      const username = res.name;
      let options = {
        httpOnly: true,
        overwrite: true,
        sameSite: true,
        maxAge: 1000 * 60 * 60 * 24, // would expire after 24 hours
      };
      const token = jwt.sign({ username }, jwtKey, {
        algorithm: "HS256",
        expiresIn: jwtExpirySeconds,
      });
      ctx.cookies.set("x-access-token", token, options);
      ctx.body = { token };
    } else {
      ctx.body = JSON.parse(
        '{"error" : "Cet identifiant est déjà associé à un compte"}'
      );
    }
  }
});

router.put("/note", async (ctx) => {
    ctx.type = "json";
    let req = JSON.stringify(ctx.request.body);
    let res = JSON.parse(req);
    if (res.content) {
      var fullDate = functions.getCurrentDate()
      await client.connect();
      const collection = client.db("notes-api").collection("notes");
      let insertNote = await collection.insertOne({
        userId: 1111,
        content: res.content,
        createdAt: fullDate,
        lastUpdatedAt: null,
      });
      console.log(insertNote.ops)
      ctx.body = insertNote.ops; //TODO : ajouter note à l'objet json ;)
    } else {
      ctx.status = 400;
      ctx.body = JSON.parse('{"error" : "null"}');
    }
  });

router.patch("/notes/:id", async (ctx) => { // id pour test : 6080722285217938b037333e
    ctx.type = "json";
    let req = JSON.stringify(ctx.request.body);
    let res = JSON.parse(req);
    let noteID
    try {
        noteID = ObjectID(ctx.url.split("/")[2])
    } catch (error) {
        noteID = 0
    }
    await jwt.verify(ctx.header["x-access-token"],globals.JWT_KEY, async (err,decoded) => {
        if (decoded) {
            if(res.content){
                await client.connect()
                const usersCollection = await client.db("notes-api").collection("users")
                const notesCollection = await client.db("notes-api").collection("notes")
                let findedUser = await usersCollection.findOne({
                    username: decoded.username,
                });
                if (findedUser) {
                    const fullDate = functions.getCurrentDate()
                    let beforeNote = await notesCollection.findOneAndUpdate(
                        { _id : noteID},
                        { $set : {
                                content : res.content,
                                lastUpdatedAt : fullDate
                            }
                        }
                    )
                    if (beforeNote.value) {
                        const tmp = JSON.parse(JSON.stringify(beforeNote.value))
                        tmp.content = res.content
                        tmp.lastUpdatedAt = fullDate
                        ctx.body = tmp
                    }
                    else{
                        // L'id de la note dans l'url est invalide
                        ctx.body = {"error" : "Cet identifiant est inconnu"}
                        ctx.status = 404
                    }
                }else{
                    // the decoded username is note found in API
                    ctx.body = {"error" : null} 
                    ctx.status = 400
                }
            }else{
                // no content in request body
                ctx.body = { "error" : null} 
                ctx.status = 400
            }
        }else{
            // Le token est invalide
            ctx.body = { "error" : "Utilisateur non connecté"}
            ctx.status = 401
        }
    })
});

router.get("/", async (ctx) => {
    ctx.body = {
        status: "success",
        message: "hello, world!",
    };
});

module.exports = router;
