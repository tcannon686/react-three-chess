# react-three-chess
react-three-chess is a simple chess app created to using
[react-three-fiber](https://github.com/pmndrs/react-three-fiber) and other
technologies like Redis, Express, and react-spring. The app is currently hosted
on heroku, and you can play it [here](https://react-three-chess.herokuapp.com)!

## Screenshots
![screenshot 0](https://github.com/tcannon686/react-three-chess/blob/main/screenshots/screenshot0.png?raw=true)
![screenshot 1](https://github.com/tcannon686/react-three-chess/blob/main/screenshots/screenshot1.png?raw=true)
![screenshot 2](https://github.com/tcannon686/react-three-chess/blob/main/screenshots/screenshot2.png?raw=true)

## Usage
To start a game, simply [click this
link](https://react-three-chess.herokuapp.com), and click _New game_. If you
scroll down on the page, you will see a link to _Play as black!_, which you can
share with your friends to battle them in an epic tournament of chess.

### Running the development server
You can also run the project on your local computer for development purposes.
To do so, do the following:
 1. Install dependencies for the backend and frontend using `yarn`.
 2. Start redis by running `redis-server`.
 3. Start the backend server using `yarn start`
 4. Start the frontend server with `cd react-ui && yarn start`

That's it! Alternatively, you can use `yarn build` in the `react-ui` folder, and
then simply run the backend server, which will host the project at
<http://localhost:5000>.
