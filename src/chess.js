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
    'R', 'k', 'B', 'Q', 'K', 'B', 'k', 'R'
  ]

  const shortToType = {
    R: 'rook',
    k: 'knight',
    P: 'pawn',
    K: 'king',
    B: 'bishop',
    Q: 'queen'
  }

  /* Create the pieces. */
  return board.map((t, i) => ({
    id: i,
    type: shortToType[t],
    color: Math.floor(i / 8) > 4 ? 'black' : 'white',
    coord: [i % 8, Math.floor(i / 8)]
  })).filter((x) => x.type)
}

/** Creates a new game (match). */
export function makeGame () {
  return {
    pieces: createPieces(),
    moveCount: 0
  }
}

/**
 * Moves a piece on the board and returns the new game state. The moveCount for
 * the game is incremented by moveCount, which is default 1.
 *
 * The previous piece is removed based on its ID.
 */
export function movePiece (game, piece, moveCount = 1) {
  const pieces = game.pieces.filter(x => (
    (x.coord[0] !== piece.coord[0] ||
      x.coord[1] !== piece.coord[1]) &&
    x.id !== piece.id
  ))
  pieces.push(piece)

  return {
    ...game,
    pieces,
    moveCount: game.moveCount + moveCount
  }
}

export function getValidMoves (game, piece) {
  const possibleCoords = []

  const direction = piece.color === 'white' ? 1 : -1

  const getPieceAtPosition = (x, y) => (
    game.pieces.filter(p => p.coord[0] === x && p.coord[1] === y)[0]
  )

  /*
   * Creates a place to attack at the given position if possible. Returns true
   * if possible, false if not in bounds or if the position would hit a friendly
   * piece.
   */
  const makeAttack = (x, y) => {
    /* Find any pieces at the position. */
    const hitPiece = getPieceAtPosition(x, y)
    const inBounds = x >= 0 && y >= 0 && x < 8 && y < 8
    const hittingFriendly = (hitPiece && hitPiece.color === piece.color)
    if (inBounds && !hittingFriendly) {
      possibleCoords.push([x, y])
      return true
    }
    return false
  }

  /*
   * Creates an attack with count directions, starting at the given offset in
   * radians.
   */
  const makeAngleAttack = (count, offset = 0, max = Infinity) => {
    for (let i = 0; i < count; i++) {
      const dx = Math.sign(Math.round(Math.cos(i * 2 * Math.PI / count + offset)))
      const dy = Math.sign(Math.round(Math.sin(i * 2 * Math.PI / count + offset)))
      let [x, y] = piece.coord

      let hitPieceCount = 0
      for (let j = 0; j < max; j++) {
        x += dx
        y += dy

        /* You can only hit one piece. */
        hitPieceCount += game.pieces
          .filter(p => p.coord[0] === x && p.coord[1] === y)
          .length

        if (!makeAttack(x, y)) {
          break
        }

        /* Stop iterating if we hit a piece. */
        if (hitPieceCount > 0) {
          break
        }
      }
    }
  }

  if (piece.type === 'pawn') {
    const forward = [piece.coord[0], piece.coord[1] + direction]
    const forward2 = [piece.coord[0], piece.coord[1] + 2 * direction]
    const left = [piece.coord[0] - 1, piece.coord[1] + direction]
    const right = [piece.coord[0] + 1, piece.coord[1] + direction]

    const leftPiece = getPieceAtPosition(...left)
    const rightPiece = getPieceAtPosition(...right)
    const forwardPiece = getPieceAtPosition(...forward)
    const forwardPiece2 = getPieceAtPosition(...forward2)

    if (leftPiece && leftPiece.color !== piece.color) {
      makeAttack(...left)
    }
    if (rightPiece && rightPiece.color !== piece.color) {
      makeAttack(...right)
    }
    if (!forwardPiece) {
      makeAttack(...forward)

      if (!forwardPiece2 && !piece.hasMoved) {
        makeAttack(...forward2)
      }
    }
  } else if (piece.type === 'queen') {
    makeAngleAttack(8)
  } else if (piece.type === 'rook') {
    makeAngleAttack(4)
  } else if (piece.type === 'bishop') {
    makeAngleAttack(4, Math.PI / 4)
  } else if (piece.type === 'king') {
    makeAngleAttack(8, 0, 1)
  } else if (piece.type === 'knight') {
    [[1, 2], [2, 1]].forEach((pair) => {
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] - pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] - pair[1])
    })
  }
  return possibleCoords
}
