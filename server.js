import path from 'path'
import express from 'express'
import redis from 'redis'
import rateLimiter from 'express-rate-limit'
import { v4 as uuidv4 } from 'uuid'
import { makeGame } from './chess.js'

import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 5000

const client = redis.createClient()
client.on('error', (error) => {
  console.error(error)
})

const api = express.Router()

api.use(express.json())

api.get('/games/:game', (req, res) => {
  const id = req.params.game
  client.get(`games:${id}`, (error, game) => {
    if (!error) {
      if (game) {
        res.json(JSON.parse(game))
      } else {
        res.status(404).end()
      }
    } else {
      res.status(500).end()
    }
  })
})

const createGameLimiter = rateLimiter({
  windowMs: 60000, /* Limit creation of new games to one per minute. */
  max: 1
})

api.post('/games', createGameLimiter, (req, res) => {
  const id = uuidv4()
  const game = { ...makeGame(), id }
  const key = `games:${id}`
  client.set(key, JSON.stringify(game), (error, result) => {
    client.expire(key, 30 * 24 * 60 * 60) /* Expire the game after a month. */
    if (!error) {
      res.json(game)
    } else {
      res.status(500).end()
    }
  })
})

api.post('/games/:id', (req, res) => {
  const id = req.params.id
  const key = `games:${id}`
  client.exists(key, (error, result) => {
    if (!error && result) {
      const newGame = req.body.game
      if (newGame.id === id) {
        client.set(key, JSON.stringify(newGame), (error, result) => {
          if (!error) {
            res.json(newGame)
          } else {
            res.status(500).end()
          }
        })
      } else {
        res.status(400).end()
      }
    } else {
      res.status(404).end()
    }
  })
})

app.use('/api', api)

/* Serve the built application. */
app.use(express.static(path.join(__dirname, 'react-ui', 'build')))
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'react-ui', 'build', 'index.html'))
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
