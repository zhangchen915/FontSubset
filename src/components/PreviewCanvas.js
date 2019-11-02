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
        if(path) path.draw(this.ctx);
    }

    render() {
        let {width, height} = this.props;
        return (
            <canvas
                width={width * this.state.ratio}
                height={height * this.state.ratio}
                style={{width, height}}
                ref={c => this.canvas = c} />
        );
    }
}
