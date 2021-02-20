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
    moveCount: 0,
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
  const prevState = {
    ...game
  }
  delete prevState.prevState

  const enPassantPiece = getEnPassantPiece(game, oldPiece, ...piece.coord)

  if (didCastle) {
    const oldDir = Math.sign(piece.coord[0] - oldPiece.coord[0])

    /* Find corresponding rook. */
    const rook = game.pieces.find(x => (
      x.type === 'rook' &&
      x.color === piece.color &&
      x.coord[1] === piece.coord[1] &&
      !x.moveCount &&
      Math.sign(x.coord[0] - oldPiece.coord[0]) === oldDir
    ))

    /* Remove old rook and king. */
    const pieces = game.pieces.filter(x => (
      (x.coord[0] !== piece.coord[0] ||
        x.coord[1] !== piece.coord[1]) &&
      x.id !== piece.id &&
      x.id !== rook.id
    ))

    pieces.push({
      ...piece,
      moveCount: piece.moveCount + moveCount
    })
    pieces.push({
      ...rook,
      moveCount: rook.moveCount + moveCount,
      coord: [oldPiece.coord[0] + oldDir, piece.coord[1]]
    })

    return {
      ...game,
      pieces,
      moveCount: game.moveCount + moveCount,
      prevState
    }
  } else if (enPassantPiece) {
    /* Handle en passant. */
    const pieces = game.pieces.filter(x => (
      x.id !== piece.id && x.id !== enPassantPiece.id
    ))
    pieces.push({
      ...piece,
      moveCount: piece.moveCount + moveCount
    })
    return {
      ...game,
      pieces,
      moveCount: game.moveCount + moveCount,
      prevState
    }
  } else {
    const pieces = game.pieces.filter(x => (
      (x.coord[0] !== piece.coord[0] ||
        x.coord[1] !== piece.coord[1]) &&
      x.id !== piece.id
    ))
    pieces.push({
      ...piece,
      moveCount: piece.moveCount + moveCount
    })
    return {
      ...game,
      pieces,
      moveCount: game.moveCount + moveCount,
      prevState
    }
  }
}

/**
 * Returns +1 or -1 depending on the direction the piece is facing.
 */
function getDirection (game, piece) {
  return piece.color === 'white' ? 1 : -1
}

/**
 * Returns the piece that would be attacked by the given pawn at the given
 * coordinates in an en passant attack. If no piece is available, returns
 * undefined.
 */
export function getEnPassantPiece (game, piece, x, y) {
  if (piece.type === 'pawn' && game.prevState) {
    const direction = getDirection(game, piece)

    const spot1 = [x, y - direction]
    const spot2 = [x, y + direction]

    const cur = getPieceAtPosition(game, ...spot1)
    const prev = getPieceAtPosition(game.prevState, ...spot2)

    if (
      cur && prev &&
      cur.id === prev.id &&
      prev.type === 'pawn' &&
      prev.color !== piece.color
    ) {
      return cur
    }
  }
}

/**
 * Returns true if the given piece can attack the piece at the given position.
 */
export function canAttack (game, piece, x, y) {
  const victim = getPieceAtPosition(game, x, y)
  return (
    (victim && victim.color !== piece.color) ||
    getEnPassantPiece(game, piece, x, y)
  )
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
    !king.moveCount &&
    !rook.moveCount &&
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

  const direction = getDirection(game, piece)

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
      } else {
        /* You can't move in a way that would put you in check. */
        const movedPiece = {
          ...piece,
          coord: [x, y]
        }
        const inCheck = isInCheck(
          updatePiece(game, movedPiece),
          piece.color)
        if (!inCheck) {
          possibleCoords.push([x, y])
        }
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

    if (leftPiece) {
      if (leftPiece.color !== piece.color) {
        makeAttack(...left)
      }
    } else {
      if (getEnPassantPiece(game, piece, ...left)) {
        makeAttack(...left)
      }
    }

    if (rightPiece) {
      if (rightPiece.color !== piece.color) {
        makeAttack(...right)
      }
    } else {
      if (getEnPassantPiece(game, piece, ...right)) {
        makeAttack(...right)
      }
    }

    if (!forwardPiece) {
      makeAttack(...forward)

      if (!forwardPiece2 && !piece.moveCount) {
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

/** Returns true if the given color can move. */
export function canMove (game, color) {
  return game.pieces.filter(x => x.color === color).some(x => (
    getValidMoves(game, x).length !== 0
  ))
}

export function isValidMove (prevState, state) {
  /* Make sure state is a valid state. */
  if (
    !prevState ||
    !state ||
    !Array.isArray(state.pieces) ||
    !state.pieces.every(x => (
      PIECE_NAMES.includes(x.type) &&
      Array.isArray(x.coord) &&
      ['black', 'white'].includes(x.color) &&
      x.id !== undefined
    ))
  ) {
    return false
  }

  const movedPieces = state.pieces.filter(x => (
    (y => !y || y.id !== x.id || y.type !== x.type)(
      getPieceAtPosition(prevState, ...x.coord)
    )
  ))

  const isValid = piece => {
    const oldPiece = prevState.pieces.find(x => x.id === piece.id)
    return (
      JSON.stringify(
        updatePiece(prevState, {
          ...piece,
          moveCount: piece.moveCount - 1
        })
      ) === JSON.stringify(state) &&
      getValidMoves(prevState, oldPiece).some(x => (
        x[0] === piece.coord[0] &&
        x[1] === piece.coord[1]
      ))
    )
  }

  if (movedPieces.length === 1) {
    return isValid(movedPieces[0])
  } else if (movedPieces.length === 2) {
    /* Check for castling. */
    const king = movedPieces.find(x => x.type === 'king')
    if (!king) {
      return false
    } else {
      return isValid(king)
    }
  } else {
    return false
  }
}

export const PIECE_NAMES = [
  'bishop',
  'king',
  'knight',
  'pawn',
  'queen',
  'rook'
]
