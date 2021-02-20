import React, { Suspense, useMemo, useState, useRef, useEffect, useContext } from 'react'
import { Canvas, useLoader, useFrame } from 'react-three-fiber'
import { a, useSpring, useTransition } from 'react-spring/three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  TextureLoader,
  PlaneGeometry,
  BufferGeometry,
  CustomBlending,
  OneFactor,
  DstAlphaFactor,
  MeshStandardMaterial,
  Color,
  MeshMatcapMaterial
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import './App.css'
import { useGames, useGame } from './hooks.js'

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  Link
} from 'react-router-dom'

import { ChessCamera } from './camera'
import {
  updatePiece,
  getValidMoves,
  canPromote,
  canMove,
  isInCheck,
  canAttack,
  PIECE_NAMES
} from 'chess-api'

const fetch = window.fetch

function makeTheme (props) {
  const {
    black,
    white,
    hover,
    active,
    attack,
    attackHover,
    move,
    moveHover
  } = props
  const textureLoader = new TextureLoader()
  const theme = {
    materials: {
      black: new MeshStandardMaterial({
        color: new Color(black),
        metalness: 0.0,
        roughness: 0.4
      }),
      white: new MeshStandardMaterial({
        color: new Color(white),
        metalness: 0.0,
        roughness: 0.4
      }),
      attack: new MeshStandardMaterial({
        color: new Color(attack),
        emissive: new Color(attack),
        metalness: 0.0,
        roughness: 0.4
      }),
      attackHover: new MeshStandardMaterial({
        color: new Color(attackHover),
        emissive: new Color(attackHover),
        metalness: 0.0,
        roughness: 0.4
      }),
      move: new MeshStandardMaterial({
        color: new Color(move),
        emissive: new Color(move)
      }),
      moveHover: new MeshStandardMaterial({
        color: new Color(moveHover),
        emissive: new Color(moveHover)
      }),
      hover: new MeshMatcapMaterial({
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: DstAlphaFactor,
        color: new Color().set(hover),
        transparent: true
      }),
      active: new MeshMatcapMaterial({
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: DstAlphaFactor,
        color: new Color().set(active),
        transparent: true
      })
    }
  }
  textureLoader.load('/textures/matcap.png', (texture) => {
    theme.materials.hover.matcap = texture
    theme.materials.active.matcap = texture
  })
  return theme
}

const ThemeContext = React.createContext(makeTheme({
  black: 0x111111,
  white: 0xCCCCCC,
  hover: 0x555555,
  active: 0xFF5500,
  attack: 0xFF0F00,
  attackHover: 0xFF0000,
  move: 0xFF5500,
  moveHover: 0xFF7711
}))

/** A chess board. */
function Board (props) {
  const colors = props.colors
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const theme = useContext(ThemeContext)
  const meshes = []

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      meshes.push(
        <mesh
          key={i + j * 8}
          geometry={geometry}
          rotation-x={-Math.PI / 2}
          position={[i, 0, j]}
          material={theme.materials[colors[(i + j) % 2]]}
          receiveShadow
        />
      )
    }
  }
  return (
    <group {...props}>
      {meshes}
    </group>
  )
}

/**
 * A clickable slot on the chessboard.
 *
 * Props:
 *  - coord - the position on the board
 */
function Slot (props) {
  const {
    attack,
    ...meshProps
  } = props
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)
  const materialName = attack
    ? (hovered ? 'attackHover' : 'attack')
    : (hovered ? 'moveHover' : 'move')
  const theme = useContext(ThemeContext)

  return (
    <a.mesh
      {...meshProps}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
      material={theme.materials[materialName]}
    >
      <boxBufferGeometry args={[0.75, 0.05, 0.75]} />
    </a.mesh>
  )
}

/**
 * A chess piece.
 *
 * Props:
 *  - active
 *  - piece
 *  - disabled
 *  - onClick
 */
function Piece (props) {
  const {
    active,
    piece,
    disabled,
    onClick,
    ...meshProps
  } = props

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  const { x, z } = useSpring({ x: piece.coord[0], z: piece.coord[1] })
  const theme = useContext(ThemeContext)

  return (
    <a.group
      position-x={x}
      position-y={0}
      position-z={z}
      rotation-y={piece.color === 'black' ? 0 : Math.PI}
    >
      <mesh
        {...meshProps}
        onPointerOver={(event) => setHover(true)}
        onPointerOut={(event) => setHover(false)}
        onClick={!disabled && onClick}
        castShadow
        receiveShadow
        material={theme.materials[piece.color]}
      />
      {(hovered || active) && !disabled && (
        <mesh
          {...meshProps}
          material={
            active ? theme.materials.active : theme.materials.hover
          }
        />
      )}
    </a.group>
  )
}

/**
 * A component for moving a piece on the board.
 *
 * This component allows the user to select where to move a piece based on the
 * piece's type.
 *
 * Props:
 *  - piece - the piece to be moved
 *  - game - the current game state
 *  - onUpdate (piece) - A callback function called with the modified piece
 */
function PieceMover (props) {
  const {
    piece,
    game,
    onUpdate
  } = props

  const transitions = useTransition(
    getValidMoves(game, piece),
    null,
    {
      config: {
        mass: 1.5,
        tension: 400
      },
      trail: 25,
      from: { scale: [0, 0, 0] },
      enter: { scale: [1, 1, 1] },
      leave: { scale: [0, 0, 0] }
    }
  )

  return (
    <>
      {transitions.map(({ item, key, props }) => (
        <Slot
          {...props}
          key={key}
          coord={item}
          onClick={() => onUpdate({
            ...piece,
            coord: item
          })}
          position={[item[0], 0.025, item[1]]}
          attack={canAttack(game, piece, ...item)}
        />
      ))}
    </>
  )
}

function useGeometries () {
  const models = useLoader(
    GLTFLoader,
    PIECE_NAMES.map((x) => `/models/${x}.glb`))
  return useMemo(() => {
    const ret = {}
    PIECE_NAMES.forEach((x, i) => {
      const geometry = new BufferGeometry()

      const geometries = []
      models[i].scene.traverse((object) => {
        if (object.geometry) {
          geometries.push(object.geometry)
        }
      })
      geometry.copy(BufferGeometryUtils.mergeBufferGeometries(geometries))

      ret[x] = geometry
    })
    return ret
  }, [models])
}

function PromoteMenuPiece (props) {
  const {
    piece,
    geometry,
    ...rest
  } = props
  const base = useRef()

  const [hovered, setHover] = useState(false)

  useFrame((state, delta) => {
    if (base.current !== null) {
      base.current.rotation.y += delta
    }
  })

  const theme = useContext(ThemeContext)

  return (
    <a.group
      {...rest}
      ref={base}
    >
      <mesh
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        material={theme.materials[piece.color]}
        geometry={geometry}
      />
      {hovered && (
        <mesh
          material={theme.materials.hover}
          geometry={geometry}
        />
      )}
    </a.group>
  )
}

function PromoteMenu (props) {
  const {
    game,
    piece,
    onUpdate
  } = props

  const geometries = useGeometries()
  const types = (
    piece && canPromote(game, piece)
      ? ['queen', 'knight', 'bishop', 'rook']
      : []
  )

  const transitions = useTransition(
    types.map((type, i) => ({
      piece,
      type,
      position: [
        piece.coord[0] + (i - types.length / 2) + 0.5,
        1,
        piece.coord[1]
      ]
    })),
    item => piece.id + ',' + item.type,
    {
      trail: 25,
      from: { scale: [0, 0, 0] },
      enter: { scale: [1, 1, 1] },
      leave: { scale: [0, 0, 0] }
    }
  )

  return (
    <>
      {transitions.map(({ item, key, props }) => (
        <PromoteMenuPiece
          {...props}
          piece={item.piece}
          key={key}
          geometry={geometries[item.type]}
          position={item.position}
          onClick={() => onUpdate({
            ...item.piece,
            type: item.type
          })}
        />
      ))}
    </>
  )
}

function Dialog (props) {
  return (
    <div className='dialog'>
      <div className='page'>
        {props.children}
      </div>
    </div>
  )
}

function Game (props) {
  const [game, setGame, color, error] = useGame()

  const geometries = useGeometries()

  const [distance, setDistance] = useState(7)

  /* The index in the pieces array of the currently selected piece. */
  const [activePiece, setActivePiece] = useState()

  if (!game) {
    if (error) {
      return (
        <div className='page'>
          <h1> Error </h1>
          <p>
            An error occured while fetching data from the server: {error}
          </p>
          <p>
            This may have occurred because the specified game is no longer valid
            (games are only kept for 30 days), or your internet connection is
            having issues.
          </p>
          <p>
            <Link to='/'>Return to Home</Link>
          </p>
        </div>
      )
    } else {
      return null
    }
  }

  const turn = game.moveCount % 2 === 0 ? 'white' : 'black'
  const opponentColor = color === 'black' ? 'white' : 'black'
  const opponentLink = `/games/${game.id}?color=${opponentColor}`

  const gameOver = !canMove(game, turn)

  const onUpdate = (newPiece) => {
    setGame(updatePiece(game, newPiece))

    /* Deselect the piece. */
    setActivePiece(undefined)
  }

  return (
    <>
      <div className='sidebar'>
        <h1> R3Chess </h1>
        <ul>
          <li>
            <Link to={opponentLink}>
              Play as {opponentColor}!
            </Link>
          </li>
          <li>
            <Link to='/'> All games </Link>
          </li>
        </ul>
      </div>
      <div className='content'>
        <Canvas
          shadowMap
          onWheel={(e) => {
            setDistance(Math.max(distance + e.deltaY * 0.1, 0))
          }}
        >
          <ChessCamera turn={color} distance={distance} />
          <hemisphereLight intensity={0.75} skyColor={0xFFFFFF} groundColor={0x0} />
          <directionalLight
            position={[1, 6, 2]}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            castShadow
          />
          <group
            position={[-3.5, 0, -3.5]}
          >
            <Board colors={['black', 'white']} />
            {game.pieces.map((piece, i) => (
              <Piece
                key={piece.id}
                geometry={geometries[piece.type]}
                game={game}
                piece={piece}
                onClick={() => setActivePiece(piece)}
                active={piece === activePiece}
                disabled={color !== piece.color || turn !== color}
              />
            ))}
            {activePiece !== undefined && (
              <PieceMover
                game={game}
                piece={activePiece}
                onUpdate={onUpdate}
              />
            )}
            <PromoteMenu
              game={game}
              piece={activePiece}
              onUpdate={onUpdate}
            />
          </group>
        </Canvas>
      </div>
      {
        gameOver && (
          <Dialog>
            <h1>Game over!</h1>
            <p>
              {
                  (isInCheck(game, turn) ? 'Checkmate: ' : 'Stalemate: ') +
                  turn + ' loses!'
                }
            </p>
          </Dialog>
        )
      }
    </>
  )
}

function CreateGame (props) {
  const [id, setId] = useState()

  useEffect(() => {
    (async () => {
      const result = await fetch(
        '/api/games',
        {
          method: 'POST'
        }
      )
      const json = await result.json()
      setId(json.id)
    })()
  }, [setId])

  if (id) {
    return <Redirect to={`/games/${id}?color=white`} />
  } else {
    return null
  }
}

function GamesList (props) {
  return (
    <table style={{ width: '100%', textAlign: 'left' }}>
      <thead>
        <tr>
          <th>Game</th>
          <th>Date</th>
          <th>Color</th>
        </tr>
      </thead>
      <tbody>
        {props.games.map((x, i) => (
          <tr key={x.id}>
            <td>
              <Link to={`/games/${x.id}?color=${x.color}`}>
                Game {i + 1}
              </Link>
            </td>
            <td>
              {new Date(x.date).toLocaleString()}
            </td>
            <td>
              {x.color}
            </td>
            <td>
              <button onClick={() => props.onDelete(x)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
        <tr><td><Link to='/games'> New game </Link></td></tr>
      </tbody>
    </table>
  )
}

function Homepage () {
  const [games, setGames] = useGames()
  const deleteGame = (game) => {
    setGames(games.filter(x => x !== game))
  }
  const codeLink = 'https://github.com/tcannon686/react-three-chess'
  const authorLink = 'http://playcannon.com/'
  return (
    <div className='page' style={{ margin: 'auto', marginTop: '16px' }}>
      <h1> R3Chess </h1>
      <h2> My Games </h2>
      <GamesList games={games} onDelete={deleteGame} />
      <h2> About </h2>
      <p>
        Welcome to R3Chess, a simple chess app! To start a game,
        click <i>New game</i> in the <i>My Games</i> section above. After you
        start a game, you will see a link to <i>Play as black!</i> in the
        sidebar, which you can copy and send to your friends! Thanks for
        playing!
      </p>
      <p>
        Note: Games are only saved for 30 days. After 30 days, your game will be
        deleted.
      </p>
      <br />
      <p>
        This project was created by <a href={authorLink}>Tom Cannon</a>. The
        source code is available on GitHub <a href={codeLink}>here</a>.
      </p>
    </div>
  )
}

function App () {
  return (
    <Router>
      <Switch>
        <Route path='/games/:id'>
          <Suspense fallback={<Dialog><p>Loading...</p></Dialog>}>
            <Game />
          </Suspense>
        </Route>
        <Route path='/games'>
          <CreateGame />
        </Route>
        <Route path='/'>
          <Homepage />
        </Route>
      </Switch>
    </Router>
  )
}

export default App
