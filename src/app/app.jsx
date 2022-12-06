import {h, Component} from 'preact';
import './app.scss';
import FontLoader from "../components/FontLoader";
import defaultFontUrl from 'url:./Staatliches-Regular.ttf';

class App extends Component {
    render() {
        return <div id="app-root">
            <div className="app">
                <FontLoader url={ defaultFontUrl}>
                </FontLoader>
            </div>
        </div>
    }
}

export default App;
