import React from "react";
import "./App.css";
import PriorityQueue from "./PriorityQueue";

const layerStyle = {
    position: "absolute",
    left: 0,
    top: 0
};

const MOVE_DIR = [[-1, 0], [0, -1], [1, 0], [0, 1]];

class App extends React.Component {
    state = {
        findingAnimation: false,
        distance: "EU",
        weight: 0.3,
        processing: false,
        canvasX: 0,
        canvasY: 0,
        rgba: "",
        drawing: false
    };

    cWidth = 600;
    canvasContainer = React.createRef();
    canvas = React.createRef();
    trace = React.createRef();

    reader = new FileReader();

    imageRatio = 0;

    c = null;
    ctx = null;
    traceC = null;
    traceCtx = null;

    start = null;
    desc = null;

    componentDidMount() {
        this.initialCanvas();
    }

    initialCanvas = () => {
        this.c = this.canvas.current;
        this.ctx = this.c.getContext("2d");

        this.traceC = this.trace.current;
        this.traceCtx = this.traceC.getContext("2d");

        this.c.oncontextmenu = () => {
            return false;
        };

        this.clear();

        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.fillRect(0, 0, this.cWidth, this.cWidth);
    };

    imageChange = e => {
        let input = e.target;

        if (input.files.length === 0) return;

        this.clear();

        this.reader.readAsDataURL(input.files[0]);
        this.reader.onload = evt => {
            let image = new Image();
            image.src = evt.target.result;
            image.onload = () => {
                this.c.height = this.cWidth * (image.height / image.width);
                this.ctx.drawImage(image, 0, 0, this.cWidth, this.cWidth * (image.height / image.width));
            };
            this.imageRatio = this.cWidth / image.width;
        };
    };

    getPixel = (x, y) => {
        if (this.ctx === null) return null;
        return this.ctx.getImageData(x, y, 1, 1).data;
    };

    onMouseMove = e => {
        if (this.ctx === null) return;

        let x = e.pageX - this.canvasContainer.current.offsetLeft;
        let y = e.pageY - this.canvasContainer.current.offsetTop;

        if (this.state.drawing) {
            console.log(e.buttons);
            this.c.style.cursor = "cell";
            switch (e.buttons) {
                case 1: {
                    this.ctx.fillStyle = "#000000";
                    this.ctx.fillRect(x - 3, y - 3, 7, 7);
                    break;
                }
                case 2: {
                    this.ctx.fillStyle = "#FFFFFF";
                    this.ctx.fillRect(x - 3, y - 3, 7, 7);
                    break;
                }
                default:
                    break;
            }
        } else if (!this.state.processing) this.c.style.cursor = this.obstacle(x, y) ? "not-allowed" : "crosshair";
        else this.c.style.cursor = "wait";

        let pixel = this.getPixel(x, y);

        this.setState({
            canvasX: x,
            canvasY: y,
            rgba: "rgba(" + pixel[0] + ", " + pixel[1] + ", " + pixel[2] + ", " + pixel[3] / 255 + ")"
        });
    };

    onClick = e => {
        if (this.ctx === null || this.state.drawing) return;
        let x = e.pageX - this.canvasContainer.current.offsetLeft;
        let y = e.pageY - this.canvasContainer.current.offsetTop;

        if (this.obstacle(x, y)) return;

        if (this.start == null) {
            this.start = [x, y];
            this.traceCtx.fillStyle = "#00FF00";
            this.traceCtx.fillRect(x - 4, y - 4, 9, 9);
        } else if (this.end == null) {
            this.end = [x, y];
            this.traceCtx.fillStyle = "#FF0000";
            this.traceCtx.fillRect(x - 4, y - 4, 9, 9);

            this.astar();
        }
    };

    obstacle = (x, y) => {
        let pixel = this.getPixel(x, y);
        if (pixel == null) return false;
        return pixel[0] + pixel[1] + pixel[2] < 128 * 3;
    };

    time = 0;
    totalSearched = 0;

    astar = () => {
        this.setState({
            processing: true
        });

        let queue = new PriorityQueue(
            (a, b) => this.state.weight * a.dist + (1 - this.state.weight) * a.heur < this.state.weight * b.dist + (1 - this.state.weight) * b.heur
        );
        let set = new Set();

        let startPoint = {
            x: this.start[0],
            y: this.start[1],
            dist: 0,
            heur: this.dist(this.end[0], this.end[1], this.start[0], this.start[1]),
            parent: null
        };

        set.add(startPoint.x + "," + startPoint.y);
        queue.push(startPoint);

        this.traceCtx.fillStyle = "#0000FF";

        this.time = Date.now();

        if (this.state.findingAnimation) {
            window.requestAnimationFrame(() => this.helper(queue, set));
        } else {
            while (!queue.isEmpty()) {
                let res = this.helper(queue, set);
                if (res != null) return;
            }
            this.printResult(null);
        }
    };

    helper = (queue, set) => {
        if (queue.isEmpty()) {
            this.printResult(null);
            return false;
        }

        let node = queue.pop();
        this.totalSearched++;

        if (node.heur === 0) {
            this.time = Date.now() - this.time;
            this.printResult(node);
            return node;
        }

        for (let i = 0; i < 4; i++) {
            let x = node.x + MOVE_DIR[i][0];
            let y = node.y + MOVE_DIR[i][1];

            // Check if the new node is valid
            if (x < 0 || x >= this.c.width || y < 0 || y >= this.c.height) continue;
            if (set.has(x + "," + y)) continue;
            if (this.obstacle(x, y)) continue;

            let newNode = {
                x,
                y,
                dist: node.dist + 1,
                heur: this.dist(this.end[0], this.end[1], x, y),
                parent: node
            };

            queue.push(newNode);
            set.add(x + "," + y);
        }

        this.traceCtx.fillRect(node.x, node.y, 1, 1);
        if (this.state.findingAnimation && this.state.processing) {
            window.requestAnimationFrame(() => this.helper(queue, set));
        }
    };

    dist(x1, y1, x2, y2) {
        if (this.state.distance === "MH") return Math.abs(x1 - x2) + Math.abs(y1 - y2);
        else return Math.sqrt(Math.pow(x1 - x2, 2) + Math.sqrt(Math.pow(y1 - y2, 2)));
    }

    printResult = node => {
        let dist = 0;
        if (node != null) {
            let cur = node;
            this.traceCtx.fillStyle = "#FCD103";
            while (cur != null) {
                this.traceCtx.fillRect(cur.x - 1, cur.y - 1, 3, 3);
                cur = cur.parent;
                dist++;
            }
        }
        alert(
            `Finish!\n\nDistance: ${node != null ? dist : "Can't Reach"}\nTotal Searched State: ${this.totalSearched}\nTime: ${this.time}ms (${Math.round(
                this.totalSearched / this.time
            )} state/ms)`
        );
        this.setState({
            processing: false
        });
    };

    clear = () => {
        this.start = null;
        this.end = null;
        if (this.traceCtx !== null) this.traceCtx.clearRect(0, 0, this.traceC.width, this.traceC.height);
    };

    checkAnimation = e => {
        this.setState({
            findingAnimation: !this.state.findingAnimation
        });
    };

    changeDistanceMethod = () => {
        this.setState({
            distance: this.state.distance === "EU" ? "MH" : "EU"
        });
    };

    changeWeight = e => {
        if (isNaN(e.target.value)) {
            this.setState({ weight: 0 });
        } else if (e.target.value >= 1) {
            this.setState({ weight: 1 });
        } else if (e.target.value <= 0) {
            this.setState({ weight: 0 });
        } else {
            this.setState({ weight: e.target.value });
        }
    };

    stop = () => {
        this.setState({
            processing: false
        });
    };

    render() {
        return (
            <>
                <div className="App">
                    <h2>Path Finding Demo by A*</h2>
                    <div className="input-group mb-3">
                        <div className="custom-file">
                            <input
                                type="file"
                                className="custom-file-input"
                                id="inputGroupFile01"
                                aria-describedby="inputGroupFileAddon01"
                                onChange={this.imageChange}
                                disabled={this.state.processing}
                            />
                            <label className="custom-file-label" htmlFor="inputGroupFile01">
                                Choose a image file
                            </label>
                        </div>
                    </div>
                    <div className="btn-toolbar" role="toolbar" aria-label="Toolbar with button groups">
                        <div className="btn-group mr-2">
                            <button
                                className={this.state.drawing ? "btn btn-primary" : "btn btn-outline-primary"}
                                onClick={() => this.setState({ drawing: !this.state.drawing })}
                                disabled={this.state.processing}
                            >
                                {this.state.drawing ? "Exit Draw" : "Draw Wall"}
                            </button>
                        </div>
                        <div className="btn-group mr-2">
                            <button className="btn btn-primary" onClick={this.initialCanvas} disabled={this.state.processing}>
                                Clear Image
                            </button>
                        </div>
                        <div className="btn-group mr-2" role="group">
                            <button className="btn btn-outline-primary" onClick={this.clear} disabled={this.state.processing}>
                                Clear Trace
                            </button>
                            <button className="btn btn-outline-danger" onClick={this.stop} disabled={!this.state.processing}>
                                Stop
                            </button>
                        </div>
                        <div className="btn-group mr-2">
                            <button
                                className={this.state.findingAnimation ? "btn btn-success" : "btn btn-secondary"}
                                onClick={this.checkAnimation}
                                disabled={this.state.processing}
                            >
                                {this.state.findingAnimation ? "Animation ON" : "Animation OFF"}
                            </button>
                        </div>
                        <div className="btn-group mr-2">
                            <button className="btn btn-primary" onClick={this.changeDistanceMethod} disabled={this.state.processing}>
                                {this.state.distance === "MH" ? "Manhattan Distance" : "Euclidean Distance"}
                            </button>
                        </div>
                        <div className="btn-group mr-2">
                            <div className="input-group">
                                <div className="input-group-prepend">
                                    <span className="input-group-text" id="inputGroup-sizing-default">
                                        Weight [0,1]
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="form-control"
                                    value={this.state.weight}
                                    onChange={this.changeWeight}
                                    disabled={this.state.processing}
                                />
                            </div>
                        </div>
                        <div className="btn-group mr-2">
                            <div className="input-group">
                                <div className="input-group-prepend">
                                    <span className="input-group-text" style={{ padding: "6px 18px", background: this.state.rgba, borderColor: "black" }} />
                                </div>
                                <button className="form-control btn btn-outline-dark">{`X: ${this.state.canvasX} Y: ${this.state.canvasY}`}</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div ref={this.canvasContainer} style={{ position: "relative", margin: "16px" }}>
                    <canvas
                        ref={this.canvas}
                        width={this.cWidth}
                        height={this.cWidth}
                        onClick={this.onClick}
                        style={{ ...layerStyle, zIndex: 0 }}
                        onMouseMove={this.onMouseMove}
                    />
                    <canvas ref={this.trace} width={this.cWidth} height={this.cWidth} style={{ ...layerStyle, pointerEvents: "none", zIndex: 1 }} />
                </div>
            </>
        );
    }
}

export default App;
