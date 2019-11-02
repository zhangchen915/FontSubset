import autobind from 'autobind-decorator';
import {Component, h} from 'preact';
import {parse, Font} from 'opentype.js';
import {PreviewCanvas} from "./PreviewCanvas";
import {Button, TextField, Chips, Slider} from 'preact-material-components';
import 'preact-material-components/Button/style.css';
import 'preact-material-components/TextField/style.css';
import 'preact-material-components/Chips/style.css';
import 'preact-material-components/Slider/style.css';

import './style.scss'

const string = {
    number: '0123456789',
    lowerCase: 'abcdefghigklmnokqrstuvwsyz',
    comma: ',.$¥'
};

@autobind
export default class FontLoader extends Component {
    state = {
        font: null,
        blob: null,
        text: {
            input: 'Hello World',
            lowerCase: '',
            upperCase: '',
            number: ''
        },
        fontSize: 58
    };

    componentWillMount() {
        if (this.props.url) this.loadURL(this.props.url);
    }

    componentWillReceiveProps(props) {
        if (this.props.url && props.url !== this.props.url) {
            this.loadURL(props.url);
        }
    }

    loadURL() {
        fetch(this.props.url)
            .then(res => res.blob())
            .then(this.loadBlob, console.error);
    }

    async getFile(e) {
        let filesCount = e.currentTarget.files.length;
        let file = e.target.files && e.target.files[0];
        if (file) this.loadBlob(file);
        this.setState({
            fileHint: filesCount === 1 ? e.currentTarget.files[0].name : `${filesCount} files selected`,
        });
    }

    async loadBlob(blob) {
        const font = parse(await blob.arrayBuffer());
        this.setState({font}, () => {
            this.setPath()
        });

    }

    setPath(text = this.state.text.input, fontSize = this.state.fontSize) {
        this.setState({
            path: this.state.font.getPath(text, 0, 80, fontSize)
        });
    }

    onTextChange(e) {
        console.log(this.state.font);
        const input = e.target.value;
        this.setState({text: Object.assign(this.state.text, {input})});
        this.setPath(input)
    }

    changeFontSize(e) {
        const fontSize = e.target.textContent;
        this.setState({fontSize});
        this.setPath(undefined, fontSize)
    }

    creatSubset() {
        const {font, text} = this.state;
        let allText = Object.values(text).join('');
        if (!allText) return;
        allText = Array.from(new Set(allText.split(''))).join('');
        const glyphs = font.stringToGlyphs(allText);
        console.log(font.glyphs.get(0))
        glyphs.unshift(font.glyphs.get(0));
        console.log(glyphs)
        const {ascender, names, unitsPerEm, descender} = font;
        const subset = new Font({
            familyName: names.fontFamily.en,
            styleName: names.fontSubfamily.en,
            unitsPerEm,
            ascender,
            descender,
            glyphs
        });

        subset.download()
    }

    chipClick(type) {
        this.setState({
            text: Object.assign(this.state.text, {
                [type]: this.state.text[type] ? '' : string[type]
            }),
        });
    }


    download(url, filename) {
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.click()
    }

    render() {
        return (
            <div className="font-loader">
                <div className="file-drop-area">
                    <span className="fake-btn">选择字体文件</span>
                    <span className="file-msg">{this.state.fileHint || '或将文件拖放到这里'}</span>
                    <input className="file-input" type="file" onChange={e => this.getFile(e)}/>
                </div>

                <TextField class="field" textarea={true} label="裁剪字符" value={this.state.text.input}
                           onInput={this.onTextChange}/>

                <Chips filter>
                    <Chips.Chip onClick={() => this.chipClick('number')}>
                        <Chips.Checkmark/>
                        <Chips.Text>数字</Chips.Text>
                    </Chips.Chip>
                    <Chips.Chip onClick={() => this.chipClick('upperCase')}>
                        <Chips.Checkmark/>
                        <Chips.Text>英文大写</Chips.Text>
                    </Chips.Chip>
                    <Chips.Chip onClick={() => this.chipClick('upperCase')}>
                        <Chips.Checkmark/>
                        <Chips.Text>英文小写</Chips.Text>
                    </Chips.Chip>
                    <Chips.Chip onClick={() => this.chipClick('upperCase')}>
                        <Chips.Checkmark/>
                        <Chips.Text>常用标点</Chips.Text>
                    </Chips.Chip>
                </Chips>

                <div>
                    <Slider step={2} value={this.state.fontSize} mix={8} max={100} discrete
                            onChange={this.changeFontSize}/>
                    <div>字体大小：{this.state.fontSize}</div>
                </div>

                <PreviewCanvas font={this.state.font} path={this.state.path}/>

                <Button class="button" ripple outlined onClick={this.creatSubset}>✂字体裁剪</Button>
            </div>
        );
    }
}
