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
