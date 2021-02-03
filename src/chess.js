/**
 * Helper function to create the pieces on the board.
 */
function createPieces () {
  /* Basic chessboard layout. */
  const board = [
    'R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    'R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R'
  ]

  const shortToType = {
    R: 'rook',
    N: 'knight',
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
 * Updates a piece on the board and returns the new game state. The moveCount
 * for the game is incremented by moveCount, which is default 1.
 *
 * The previous piece is removed based on its ID.
 */
export function updatePiece (game, piece, moveCount = 1) {
  /* Determine if the piece castled. */
  const oldPiece = game.pieces.find(x => x.id === piece.id)
  const didCastle = (
    piece.type === 'king' &&
    Math.abs(piece.coord[0] - oldPiece.coord[0]) === 2
  )

  if (didCastle) {
    const direction = Math.sign(piece.coord[0] - oldPiece.coord[0])

    /* Find corresponding rook. */
    const rook = game.pieces.find(x => (
      x.type === 'rook' &&
      x.color === piece.color &&
      x.coord[1] === piece.coord[1] &&
      !x.hasMoved &&
      Math.sign(x.coord[0] - oldPiece.coord[0]) === direction
    ))

    /* Remove old rook and king. */
    const pieces = game.pieces.filter(x => (
      (x.coord[0] !== piece.coord[0] ||
        x.coord[1] !== piece.coord[1]) &&
      x.id !== piece.id &&
      x.id !== rook.id
    ))

    pieces.push(piece)
    pieces.push({
      ...rook,
      hasMoved: true,
      coord: [oldPiece.coord[0] + direction, piece.coord[1]]
    })

    return {
      ...game,
      pieces,
      moveCount: game.moveCount + moveCount
    }
  } else {
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
}

export function getPieceAtPosition (game, x, y) {
  return game.pieces.filter(p => p.coord[0] === x && p.coord[1] === y)[0]
}

/**
 * Returns a list of pieces that can attack the given piece.
 */
export function getVulnerabilities (game, piece) {
  return game.pieces.filter(x => (
    x.color !== piece.color &&
    getValidMoves(game, x, true).some(x => (
      x[0] === piece.coord[0] && x[1] === piece.coord[1]
    ))
  ))
}

/**
 * Returns true if the given piece is vulnerable.
 */
export function isVulnerable (game, piece) {
  return getVulnerabilities(game, piece).length > 0
}

/**
 * Returns true if the given piece can castle.
 */
export function canCastle (game, king, rook) {
  return (
    king.type === 'king' &&
    rook.type === 'rook' &&
    !king.hasMoved &&
    !rook.hasMoved &&
    game.pieces.filter(x => (
      x.coord[1] === king.coord[1] &&
      x.coord[0] > Math.min(king.coord[0], rook.coord[0]) &&
      x.coord[0] < Math.max(king.coord[0], rook.coord[0])
    )).length === 0 &&
    !isVulnerable(game, king)
  )
}

/**
 * Returns true if the given piece can promote (i.e. it is a pawn and at the end
 * of the board).
 */
export function canPromote (game, piece) {
  return (
    piece.type === 'pawn' &&
    ((piece.color === 'white' && piece.coord[1] === 7) ||
      (piece.color === 'black' && piece.coord[1] === 0))
  )
}

/**
 * Returns the possible positions the given piece can move to.
 *
 * If attacksOnly is true, only return attacks.
 */
export function getValidMoves (game, piece, attacksOnly = false) {
  const possibleCoords = []

  const direction = piece.color === 'white' ? 1 : -1
  const check = !attacksOnly && isInCheck(game, piece.color)

  /*
   * Creates a place to attack at the given position if possible. Returns true
   * if possible, false if not in bounds or if the position would hit a friendly
   * piece.
   */
  const makeAttack = (x, y) => {
    /* Find any pieces at the position. */
    const hitPiece = getPieceAtPosition(game, x, y)
    const inBounds = x >= 0 && y >= 0 && x < 8 && y < 8
    const hittingFriendly = (hitPiece && hitPiece.color === piece.color)
    if (inBounds && !hittingFriendly) {
      if (attacksOnly) {
        if (hitPiece && hitPiece.color !== piece.color) {
          possibleCoords.push([x, y])
        }
      } else if (check) {
        /*
         * If you are in check, you can only make moves that will get you out of
         * check.
         */
        const movedPiece = {
          ...piece,
          coord: [x, y]
        }
        const stillInCheck = isInCheck(
          updatePiece(game, movedPiece),
          piece.color)
        if (!stillInCheck) {
          possibleCoords.push([x, y])
        }
      } else {
        possibleCoords.push([x, y])
      }
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

      for (let j = 0; j < max; j++) {
        x += dx
        y += dy

        if (!makeAttack(x, y)) {
          break
        }

        /* Stop iterating if we hit a piece. */
        if (getPieceAtPosition(game, x, y)) {
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

    const leftPiece = getPieceAtPosition(game, ...left)
    const rightPiece = getPieceAtPosition(game, ...right)
    const forwardPiece = getPieceAtPosition(game, ...forward)
    const forwardPiece2 = getPieceAtPosition(game, ...forward2)

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

    /* Handle castling. */
    const rooks = game.pieces.filter(x => (
      x.type === 'rook' && x.color === piece.color
    )).sort((a, b) => a.coord[0] < b.coord[0])

    rooks.forEach(rook => {
      if (!attacksOnly && canCastle(game, piece, rook)) {
        makeAttack(
          piece.coord[0] + (rook.coord[0] < piece.coord[0] ? -2 : 2),
          piece.coord[1]
        )
      }
    })
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

export function isInCheck (game, color) {
  const king = game.pieces.find(x => x.color === color && x.type === 'king')
  return isVulnerable(game, king)
}

export const PIECE_NAMES = [
  'bishop',
  'king',
  'knight',
  'pawn',
  'queen',
  'rook'
]
