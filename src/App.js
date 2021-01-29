import logo from './logo.svg';

import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from 'react-three-fiber'
import { a, useSpring } from 'react-spring/three'

/**
 * A clickable slot on the chessboard.
 *
 * Props:
 *  - coord - the position on the board
 */
function Slot (props) {
  const mesh = useRef()

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  return (
    <mesh
      {...props}
      ref={mesh}
      position={[props.coord[0], 0, props.coord[1]]}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <boxBufferGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

/**
 * A chess piece.
 *
 * Props:
 *  - active
 *  - color
 *  - coord - the position on the board
 *  - disabled
 *  - onClick
 */
function Piece (props) {
  const {
    active,
    color,
    coord,
    disabled,
    onClick,
    ...meshProps
  } = props

  // This reference will give us direct access to the mesh
  const mesh = useRef()

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  const {x, z} = useSpring({ x: coord[0], z: coord[1] })

  return (
    <a.mesh
      {...meshProps}
      ref={mesh}
      position-x={x}
      position-y={0.5}
      position-z={z}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
      onClick={!disabled && onClick}
    >
      <boxBufferGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={
        active
          ? 'orange'
          : (!disabled && hovered ? 'hotpink' : color)
      } />
    </a.mesh>
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
 *  - onChange (piece) - A callback function called with the modified piece
 */
function PieceMover (props) {
  const {
    piece,
    onChange
  } = props

  let possibleCoords = []

  const direction = piece.color === 'white' ? 1 : -1

  const makeAttack = (x, y) => {
    if (x >= 0 && y >= 0 && x < 8 && y < 8) {
      possibleCoords.push([x, y])
      return true
    }
    return false
  }

  const makeAngleAttack = (count, offset = 0, max = Infinity) => {
    possibleCoords = []
    for (let i = 0; i < count; i ++) {
      const dx = Math.sign(Math.round(Math.cos(i * 2 * Math.PI / count + offset)))
      const dy = Math.sign(Math.round(Math.sin(i * 2 * Math.PI / count + offset)))
      let [x, y] = piece.coord
      for (let j = 0; j < max; j ++) {
        x += dx
        y += dy
        if (!makeAttack(x, y)) {
          break
        }
      }
    }
  }

  if (piece.type === 'pawn') {
    possibleCoords = [[piece.coord[0], piece.coord[1] + direction]]
  } else if (piece.type === 'queen') {
    makeAngleAttack(10)
  } else if (piece.type === 'rook') {
    makeAngleAttack(4)
  } else if (piece.type === 'bishop') {
    makeAngleAttack(4, Math.PI / 4)
  } else if (piece.type === 'king') {
    makeAngleAttack(10, 0, 1)
  } else if (piece.type === 'knight') {
    [[1, 2], [2, 1]].forEach((pair) => {
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] - pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] - pair[1])
    })
  }

  return (
    <>
      {possibleCoords.map((coord, i) => (
        <Slot
          key={i}
          coord={coord}
          onClick={() => onChange({
            ...piece,
            coord
          })}
        />
      ))}
    </>
  )
}

/**
 * Helper function to create the pieces on the board.
 */
function createPieces () {
  /* Basic chessboard layout. */
  const board = [
    'R', 'k', 'B', 'Q', 'K', 'B', 'k', 'R',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    'R', 'k', 'B', 'Q', 'K', 'B', 'k', 'R',
  ]

  const shortToType = {
    'R': 'rook',
    'k': 'knight',
    'P': 'pawn',
    'K': 'king',
    'B': 'bishop',
    'Q': 'queen'
  }

  /* Create the pieces. */
  return board.map((t, i) => ({
    type: shortToType[t],
    color: Math.floor(i / 8) > 4 ? 'black' : 'white',
    coord: [i % 8, Math.floor(i / 8)]
  })).filter((x) => x.type)
}

function App() {
  const [pieces, setPieces] = useState(createPieces())

  /* The index in the pieces array of the currently selected piece. */
  const [activePieceIndex, setActivePieceIndex] = useState()

  return (
    <>
      <Canvas
        camera={{
          position: [0, 5, -7]
        }}
      >
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <group
          position={[-4, 0, -4]}
        >
          {pieces.map((piece, i) => (
            <Piece
              {...piece}
              key={i}
              onClick={() => setActivePieceIndex(i)}
              active={i === activePieceIndex}
            />
          ))}
          {activePieceIndex !== undefined && (
            <PieceMover
              piece={pieces[activePieceIndex]}
              onChange={(piece) => {
                const clone = [...pieces]
                clone[activePieceIndex] = piece
                setPieces(clone)
              }}
            />
          )}
        </group>
      </Canvas>
    </>
  );
}

export default App;
