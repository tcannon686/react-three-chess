/*
 * Reusable react hooks.
 */

import { useState, useEffect, useCallback } from 'react'

import {
  useParams,
  useLocation
} from 'react-router-dom'

const fetch = window.fetch

export function useQuery () {
  return new URLSearchParams(useLocation().search)
}

/*
 * Returns the current value, and a setter for the current value of the players
 * games.
 */
export function useGames () {
  const [games, setGames] = useState(() => (
    JSON.parse(window.localStorage.getItem('games') || '[]')
  ))
  return [
    games,
    (x) => {
      window.localStorage.setItem('games', JSON.stringify(x))
      setGames(x)
    }
  ]
}

export function useGame () {
  const { id } = useParams()
  const query = useQuery()
  const color = query.get('color')
  const [game, setGame] = useState()
  const [games, setGames] = useGames()

  const update = useCallback(async () => {
    const result = await fetch(
      `/api/games/${id}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    const newGame = await result.json()
    /* Update if a piece was moved, or the game has not been loaded yet. */
    if (!game || newGame.moveCount > game.moveCount) {
      setGame(newGame)
    }
  }, [game, setGame, id])

  useEffect(() => {
    update()
  }, [update])

  useEffect(() => {
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [update])

  const updateGame = (game) => {
    (async () => {
      const result = await fetch(
        `/api/games/${id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            game
          })
        }
      )
      const newGame = await result.json()
      setGame(newGame)
    })()
  }

  useEffect(() => {
    if (!games.find(x => x.id === id)) {
      setGames([
        ...games,
        {
          id,
          color,
          date: Date.now()
        }
      ])
    }
  }, [games, setGames, id, color])

  return [game, updateGame, color]
}
