import {h, Component} from 'preact';
import './app.scss';
import FontLoader from "../components/FontLoader";
import Preview from "../components/Priview";
import defaultFontUrl from './AdobeVFPrototype.otf';
import CollectionSelector from "../components/CollectionSelector";
import VariationSelector from "./VariationSelector";

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
