import { onMount, createSignal } from "solid-js";
import * as v2 from "../lib/vec";

const WIDTH = 400;
const HEIGHT = 400;
const NUM_AGENTS = 500;
const DECAY = 0.5;
const MIN_CHEM = 0.0001;
const SENS_ANGLE = (45 * Math.PI) / 180;
const SENS_DIST = 5;
const AGT_SPEED = 3;
const AGT_ANGLE = (45 * Math.PI) / 180;
const DEPOSIT = 5;
const TEXTURE = ["  ``^@", " ..„v0ah"];
const OOB = "";

interface Vec2 {
	x: number;
	y: number;
}

class Agent {
	pos: Vec2;
	dir: Vec2;
	scatter: boolean;

	constructor(pos: Vec2, dir: Vec2) {
		this.pos = pos;
		this.dir = dir;
		this.scatter = false;
	}

	sense(m: number, chem: Float32Array): number {
		const senseVec = v2.mulN(v2.rot(this.dir, m * SENS_ANGLE), SENS_DIST);
		const pos = v2.floor(v2.add(this.pos, senseVec));
		if (!bounded(pos)) return -1;
		const sensed = chem[pos.y * HEIGHT + pos.x];
		if (this.scatter) return 1 - sensed;
		return sensed;
	}

	react(chem: Float32Array) {
		let forwardChem = this.sense(0, chem);
		let leftChem = this.sense(-1, chem);
		let rightChem = this.sense(1, chem);

		let rotate = 0;
		if (forwardChem > leftChem && forwardChem > rightChem) {
			rotate = 0;
		} else if (forwardChem < leftChem && forwardChem < rightChem) {
			if (Math.random() < 0.5) {
				rotate = -AGT_ANGLE;
			} else {
				rotate = AGT_ANGLE;
			}
		} else if (leftChem < rightChem) {
			rotate = AGT_ANGLE;
		} else if (rightChem < leftChem) {
			rotate = -AGT_ANGLE;
		} else if (forwardChem < 0) {
			rotate = Math.PI / 2;
		}
		this.dir = v2.rot(this.dir, rotate);

		this.pos = v2.add(this.pos, v2.mulN(this.dir, AGT_SPEED));
	}

	deposit(chem: Float32Array) {
		const { y, x } = v2.floor(this.pos);
		const i = y * HEIGHT + x;
		chem[i] = Math.min(1, chem[i] + DEPOSIT);
	}
}

function bounded(vec: Vec2): boolean {
	const R = Math.min(WIDTH, HEIGHT) / 2;
	return (vec.x - R) ** 2 + (vec.y - R) ** 2 <= R ** 2;
}

function blur(row: number, col: number, data: Float32Array): number {
	let sum = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			sum += data[(row + dy) * HEIGHT + col + dx] ?? 0;
		}
	}
	return sum / 9;
}

function randCircle(): Vec2 {
	const r = Math.sqrt(Math.random());
	const theta = Math.random() * 2 * Math.PI;
	return {
		x: r * Math.cos(theta),
		y: r * Math.sin(theta),
	};
}

interface Context {
	rows: number;
	cols: number;
	metrics: { aspect: number };
	frame: number;
}

interface Cursor {
	pressed: boolean;
	x: number;
	y: number;
}

interface Data {
	chem: Float32Array;
	wip: Float32Array;
	agents: Agent[];
	viewScale: { y: number; x: number };
	viewFocus: { y: number; x: number };
}

function boot(context: Context, buffer: any, data: Data) {
	data.chem = new Float32Array(HEIGHT * WIDTH);
	data.wip = new Float32Array(HEIGHT * WIDTH);

	data.agents = [];
	for (let agent = 0; agent < NUM_AGENTS; agent++) {
		data.agents.push(
			new Agent(
				v2.mulN(v2.addN(v2.mulN(randCircle(), 0.5), 1), 0.5 * WIDTH),
				v2.rot(v2.vec2(1, 0), Math.random() * 2 * Math.PI),
			),
		);
	}

	let targetScale;
	if (context.rows / context.metrics.aspect < context.cols) {
		targetScale = {
			y: (1.1 * WIDTH) / context.rows,
			x: ((1.1 * WIDTH) / context.rows) * context.metrics.aspect,
		};
	} else {
		targetScale = {
			y: (1.1 * WIDTH) / context.cols / context.metrics.aspect,
			x: (1.1 * WIDTH) / context.cols,
		};
	}
	data.viewScale = targetScale;
	data.viewFocus = { y: 0.5, x: 0.5 };
}

function pre(context: Context, cursor: Cursor, buffer: any, data: Data) {
	for (let row = 0; row < HEIGHT; row++) {
		for (let col = 0; col < WIDTH; col++) {
			let val = DECAY * blur(row, col, data.chem);
			if (val < MIN_CHEM) val = 0;
			data.wip[row * HEIGHT + col] = val;
		}
	}
	const swap = data.chem;
	data.chem = data.wip;
	data.wip = swap;

	const { chem, agents } = data;

	const isScattering = Math.sin(context.frame / 150) > 0.8;
	for (const agent of agents) {
		agent.scatter = isScattering;
		agent.react(chem);
	}

	for (const agent of agents) {
		agent.deposit(chem);
	}

	updateView(cursor, context, data);
}

function main(
	coord: { x: number; y: number },
	context: Context,
	cursor: Cursor,
	buffer: any,
	data: Data,
): string {
	const { viewFocus, viewScale } = data;

	const offset = {
		y: Math.floor(viewFocus.y * (HEIGHT - viewScale.y * context.rows)),
		x: Math.floor(viewFocus.x * (WIDTH - viewScale.x * context.cols)),
	};

	const sampleFrom = {
		y: offset.y + Math.floor(coord.y * viewScale.y),
		x: offset.x + Math.floor(coord.x * viewScale.x),
	};

	const sampleTo = {
		y: offset.y + Math.floor((coord.y + 1) * viewScale.y),
		x: offset.x + Math.floor((coord.x + 1) * viewScale.x),
	};

	if (!bounded(sampleFrom) || !bounded(sampleTo)) return OOB;

	const sampleH = Math.max(1, sampleTo.y - sampleFrom.y);
	const sampleW = Math.max(1, sampleTo.x - sampleFrom.x);

	let max = 0;
	let sum = 0;
	for (let x = sampleFrom.x; x < sampleFrom.x + sampleW; x++) {
		for (let y = sampleFrom.y; y < sampleFrom.y + sampleH; y++) {
			const v = data.chem[y * HEIGHT + x];
			max = Math.max(max, v);
			sum += v;
		}
	}
	let val = sum / (sampleW * sampleH);
	val = (val + max) / 2;

	val = Math.pow(val, 1 / 3);

	const texRow = (coord.x + coord.y) % TEXTURE.length;
	const texCol = Math.ceil(val * (TEXTURE[0].length - 1));
	const char = TEXTURE[texRow][texCol];
	if (!char) throw new Error(`Invalid char for ${val}`);

	return char;
}

function updateView(cursor: Cursor, context: Context, data: Data) {
	let targetScale;
	if (cursor.pressed) {
		targetScale = {
			y: 1 / context.metrics.aspect,
			x: 1,
		};
	} else if (context.rows / context.metrics.aspect < context.cols) {
		targetScale = {
			y: (1.1 * WIDTH) / context.rows,
			x: ((1.1 * WIDTH) / context.rows) * context.metrics.aspect,
		};
	} else {
		targetScale = {
			y: (1.1 * WIDTH) / context.cols / context.metrics.aspect,
			x: (1.1 * WIDTH) / context.cols,
		};
	}

	if (
		data.viewScale.y !== targetScale.y ||
		data.viewScale.x !== targetScale.x
	) {
		data.viewScale.y += 0.1 * (targetScale.y - data.viewScale.y);
		data.viewScale.x += 0.1 * (targetScale.x - data.viewScale.x);
	}

	let targetFocus = !cursor.pressed
		? { y: 0.5, x: 0.5 }
		: { y: cursor.y / context.rows, x: cursor.x / context.cols };
	if (
		data.viewFocus.y !== targetFocus.y ||
		data.viewFocus.x !== targetFocus.x
	) {
		data.viewFocus.y += 0.1 * (targetFocus.y - data.viewFocus.y);
		data.viewFocus.x += 0.1 * (targetFocus.x - data.viewFocus.x);
	}
}

const SlimeDish = () => {
	const [text, setText] = createSignal("");

	onMount(() => {
		const rows = 80;
		const cols = 80;

		const mockContext: Context = {
			rows,
			cols,
			metrics: { aspect: 1 }, // assume square
			frame: 0,
		};
		const mockBuffer = {};
		const data: Data = {} as Data;
		boot(mockContext, mockBuffer, data);

		const animate = () => {
			mockContext.frame++;
			const mockCursor: Cursor = { pressed: false, x: 0, y: 0 };
			pre(mockContext, mockCursor, mockBuffer, data);

			const lines: string[] = [];
			for (let y = 0; y < rows; y++) {
				let line = "";
				for (let x = 0; x < cols; x++) {
					const coord = { x, y };
					const char = main(coord, mockContext, mockCursor, mockBuffer, data);
					line += char;
				}
				lines.push(line);
			}
			setText(lines.join("\n"));

			requestAnimationFrame(animate);
		};

		animate();
	});

	return (
		<div
			aria-hidden="true"
			style={{
				"font-family": "monospace",
				"font-size": "8px",
				"line-height": "5px",
				color: "black",
				"white-space": "pre",
				display: "inline-block",
				"text-align": "center",
			}}
		>
			{text()}
		</div>
	);
};

export default SlimeDish;
