import {Component, h} from 'preact';

export class PreviewCanvas extends Component {
    static defaultProps = {
        width: 500,
        height: 100
    };

    state = {
        ratio: 1
    };

    componentDidMount() {
        this.ctx = this.canvas.getContext('2d');
        this.setState({ratio: window.devicePixelRatio || 1});
    }

    componentDidUpdate() {
        let {font, path, fontSize, width, height} = this.props;
        this.ctx.clearRect(0, 0, width, height);
        if (!path) return;
        this.canvas.width = path.getBoundingBox().x2;
        path.draw(this.ctx);
        setTimeout(() => {
            this.canvas.scrollIntoView({behavior: "smooth", block: "center", inline: "end"});
        }, 0)
    }

    render() {
        let {width, height} = this.props;
        return (
            <div class="canvasWrap">
                <canvas
                    width={width * this.state.ratio}
                    height={height * this.state.ratio}
                    ref={c => this.canvas = c}/>
            </div>
        );
    }
}
