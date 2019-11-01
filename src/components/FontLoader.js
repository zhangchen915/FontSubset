import autobind from 'autobind-decorator';
import {Component, h} from 'preact';
import fontkit from 'fontkit';
import blobToBuffer from 'blob-to-buffer';
import {PreviewCanvas} from "./PreviewCanvas";
import {Button, TextField, Chips, Slider} from 'preact-material-components';
import 'preact-material-components/Button/style.css';
import 'preact-material-components/TextField/style.css';
import 'preact-material-components/Chips/style.css';
import 'preact-material-components/Slider/style.css';

import './style.scss'

import {Writable} from 'readable-stream'

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
        fontSize: 46
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

    loadBlob(blob) {
        blobToBuffer(blob, (err, buffer) => {
            if (err) throw err;
            const font = fontkit.create(buffer);
            this.setState({
                font,
                run: font.layout(this.state.text.input)
            });
        });
    }

    onTextChange(e) {
        const input = e.target.value;
        this.setState({
            text: Object.assign(this.state.text, {input}),
            run: this.state.font.layout(input)
        });
    }

    creatSubset() {
        const allText = Object.values(this.state.text).join('');
        let allChunk = new Uint8Array();

        const writable = new Writable({
            write(chunk, encoding, callback) {
                const mergedArray = new Uint8Array(allChunk.length + chunk.length);
                mergedArray.set(allChunk);
                mergedArray.set(chunk, allChunk.length);
                allChunk = mergedArray;
                callback(); // clearBuffer
            }
        });

        if (!allText) return;
        const run = this.state.font.layout(allText);
        const subset = this.state.font.createSubset();
        run.glyphs.forEach(glyph => subset.includeGlyph(glyph));

        setTimeout(() => {
            console.log(subset)
            subset.encodeStream().pipe(writable);
            writable.on('finish', () => {
                console.log(allChunk)
                const blob = new Blob([allChunk], {type: "octet/stream"});
                this.download(window.URL.createObjectURL(blob), `${this.state.font.postscriptName}-subset.ttf`)
                console.info('写入已完成');
            });
        }, 0)
    }

    changeFontSize(e) {
        this.setState({fontSize: e.target.textContent})
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

                <PreviewCanvas font={this.state.font} run={this.state.run} fontSize={this.state.fontSize}/>

                <Button class="button" ripple outlined onClick={this.creatSubset}>✂字体裁剪</Button>
            </div>
        );
    }
}
