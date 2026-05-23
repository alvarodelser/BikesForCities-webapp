import type maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';

export const ACCUM_LAYER_ID = 'od-accum-layer';

function toMercator(lng: number, lat: number): [number, number] {
    const x = (lng + 180) / 360;
    const sin = Math.sin(lat * Math.PI / 180);
    const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    return [x, y];
}

// Body only — MapLibre's vertexShaderPrelude is prepended at compile time.
// The prelude defines u_projection_matrix and projectTile(vec2 p).
// Inputs a_pos / a_other are [0,1] Mercator coordinates.
const VERT_ACCUM_BODY = `
precision highp float;
uniform vec2  u_viewport;
uniform float u_halfwidth;
in vec2  a_pos;
in vec2  a_other;
in float a_side;

void main() {
    vec4 pc = projectTile(a_pos);
    vec4 oc = projectTile(a_other);
    vec2 p  = (pc.xy / pc.w * 0.5 + 0.5) * u_viewport;
    vec2 o  = (oc.xy / oc.w * 0.5 + 0.5) * u_viewport;
    vec2 seg = o - p;
    float len = length(seg);
    if (len < 0.5) { gl_Position = vec4(2.0, 0.0, 0.0, 1.0); return; }
    vec2 perp = vec2(-seg.y, seg.x) / len;
    vec2 px   = p + a_side * u_halfwidth * perp;
    gl_Position = vec4(px / u_viewport * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_ACCUM = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0, 0.0, 0.0, 0.0); }`;

const VERT_COMP = `#version 300 es
precision highp float;
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG_COMP = `#version 300 es
precision highp float;
uniform sampler2D u_acc;
uniform float     u_max_count;
uniform float     u_opacity;
out vec4 fragColor;

// Smooth continuous gradient: light indigo → vivid purple → amber
vec3 flowGradient(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = vec3(0.78, 0.73, 0.98);  // light indigo
    vec3 b = vec3(0.50, 0.08, 0.86);  // vivid purple
    vec3 c = vec3(0.96, 0.50, 0.08);  // warm amber
    if (t < 0.5) return mix(a, b, t * 2.0);
    return mix(b, c, (t - 0.5) * 2.0);
}

void main() {
    float count = texelFetch(u_acc, ivec2(gl_FragCoord.xy), 0).r;
    if (count < 0.5) discard;
    float t   = log(1.0 + count) / log(1.0 + u_max_count);
    vec3  col = flowGradient(t);
    // sqrt gives faint flows a fighting chance while heavy bundles stay saturated
    float a   = clamp(sqrt(t) * u_opacity, 0.0, 1.0);
    fragColor = vec4(col * a, a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error(`Shader compile:\n${gl.getShaderInfoLog(sh)}`);
    return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   vert));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(`Program link: ${gl.getProgramInfoLog(prog)}`);
    return prog;
}

function buildSegments(features: GeoJSON.Feature[]): {
    verts: Float32Array; indices: Uint32Array; segCount: number;
} {
    let segCount = 0;
    for (const f of features)
        segCount += Math.max(0, (f.geometry as GeoJSON.LineString).coordinates.length - 1);

    const verts   = new Float32Array(segCount * 4 * 5);
    const indices = new Uint32Array(segCount * 6);
    let vi = 0, ii = 0, base = 0;

    for (const f of features) {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
        for (let k = 0; k < coords.length - 1; k++) {
            const [x0, y0] = toMercator(coords[k][0],   coords[k][1]);
            const [x1, y1] = toMercator(coords[k+1][0], coords[k+1][1]);
            verts[vi++]=x0; verts[vi++]=y0; verts[vi++]=x1; verts[vi++]=y1; verts[vi++]=-1;
            verts[vi++]=x0; verts[vi++]=y0; verts[vi++]=x1; verts[vi++]=y1; verts[vi++]=+1;
            verts[vi++]=x1; verts[vi++]=y1; verts[vi++]=x0; verts[vi++]=y0; verts[vi++]=-1;
            verts[vi++]=x1; verts[vi++]=y1; verts[vi++]=x0; verts[vi++]=y0; verts[vi++]=+1;
            indices[ii++]=base; indices[ii++]=base+1; indices[ii++]=base+2;
            indices[ii++]=base+1; indices[ii++]=base+3; indices[ii++]=base+2;
            base += 4;
        }
    }
    return { verts, indices, segCount };
}

export class ODAccumulationLayer implements maplibregl.CustomLayerInterface {
    readonly id   = ACCUM_LAYER_ID;
    readonly type = 'custom' as const;
    readonly renderingMode = '2d' as const;

    private gl!: WebGL2RenderingContext;
    private ready = false;

    // accumProg is compiled lazily on first render() — needs the MapLibre prelude
    private accumProg: WebGLProgram | null = null;
    private accumProgFailed = false;
    private compProg!:  WebGLProgram;
    private accumVAO!:  WebGLVertexArrayObject;
    private accumVBO!:  WebGLBuffer;
    private accumEBO!:  WebGLBuffer;
    private quadVAO!:   WebGLVertexArrayObject;
    private quadVBO!:   WebGLBuffer;
    private fbo!:       WebGLFramebuffer;
    private accTex!:    WebGLTexture;
    private fbW = 0;
    private fbH = 0;

    private indexCount = 0;
    private maxCount   = 30;

    setData(features: GeoJSON.Feature[]) {
        const { verts, indices, segCount } = buildSegments(features);
        this.indexCount = segCount * 6;
        this.maxCount   = Math.max(10, Math.ceil(features.length * 0.15));

        if (!this.ready) {
            (this as any)._pendingVerts   = verts;
            (this as any)._pendingIndices = indices;
            return;
        }
        this._upload(verts, indices);
    }

    onAdd(_map: maplibregl.Map, gl: WebGL2RenderingContext) {
        this.gl = gl;

        try {
            this.compProg = linkProgram(gl, VERT_COMP, FRAG_COMP);
        } catch (e) {
            console.error('[ODAccumulationLayer] shader error:', e);
            return;
        }

        // Accumulation VAO — attribute pointers configured after lazy compilation
        this.accumVAO = gl.createVertexArray()!;
        this.accumVBO = gl.createBuffer()!;
        this.accumEBO = gl.createBuffer()!;
        gl.bindVertexArray(this.accumVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,         this.accumVBO);
        gl.bufferData(gl.ARRAY_BUFFER,         new Float32Array(0), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.accumEBO);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(0),  gl.DYNAMIC_DRAW);
        gl.bindVertexArray(null);

        // Full-screen composite quad VAO
        this.quadVAO = gl.createVertexArray()!;
        this.quadVBO = gl.createBuffer()!;
        gl.bindVertexArray(this.quadVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        const lQ = gl.getAttribLocation(this.compProg, 'a_pos');
        gl.enableVertexAttribArray(lQ);
        gl.vertexAttribPointer(lQ, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        this.accTex = gl.createTexture()!;
        this.fbo    = gl.createFramebuffer()!;
        this.ready  = true;

        if ((this as any)._pendingVerts) {
            this._upload((this as any)._pendingVerts, (this as any)._pendingIndices);
            delete (this as any)._pendingVerts;
            delete (this as any)._pendingIndices;
        }
    }

    render(rawGl: WebGL2RenderingContext | WebGLRenderingContext, options: maplibregl.CustomRenderMethodInput) {
        const gl = rawGl as WebGL2RenderingContext;
        if (!this.ready || this.indexCount === 0) return;

        // Lazy-compile on first render — needs vertexShaderPrelude, unavailable in onAdd.
        // The prelude provides u_projection_matrix and projectTile() but NOT #version 300 es.
        if (!this.accumProg && !this.accumProgFailed) {
            const vertSrc = '#version 300 es\n' + options.shaderData.vertexShaderPrelude + VERT_ACCUM_BODY;
            try {
                this.accumProg = linkProgram(gl, vertSrc, FRAG_ACCUM);
                this._setupAccumVAO(gl);
            } catch (e) {
                console.error('[ODAccumulationLayer] accum shader error:', e);
                this.accumProgFailed = true;
                return;
            }
        }
        if (!this.accumProg) return;

        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        this._ensureFBO(gl, w, h);

        const callerFBO      = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const scissorEnabled = gl.isEnabled(gl.SCISSOR_TEST);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);
        if (scissorEnabled) gl.disable(gl.SCISSOR_TEST);

        // ── Pass 1: accumulate segment overdraw into float FBO ────────────────
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.useProgram(this.accumProg);
        // defaultProjectionData.mainMatrix is pre-scaled by EXTENT=8192 so that
        // [0,1] Mercator passed to projectTile() maps correctly to clip space.
        gl.uniformMatrix4fv(
            gl.getUniformLocation(this.accumProg, 'u_projection_matrix'),
            false,
            new Float32Array(options.defaultProjectionData.mainMatrix),
        );
        gl.uniform2f(gl.getUniformLocation(this.accumProg, 'u_viewport'),  w, h);
        gl.uniform1f(gl.getUniformLocation(this.accumProg, 'u_halfwidth'), 2.5);

        gl.bindVertexArray(this.accumVAO);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        // ── Pass 2: composite FBO onto map framebuffer ────────────────────────
        gl.bindFramebuffer(gl.FRAMEBUFFER, callerFBO);
        gl.viewport(0, 0, w, h);

        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.compProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.accTex);
        gl.uniform1i(gl.getUniformLocation(this.compProg, 'u_acc'),       0);
        gl.uniform1f(gl.getUniformLocation(this.compProg, 'u_max_count'), this.maxCount);
        gl.uniform1f(gl.getUniformLocation(this.compProg, 'u_opacity'),   0.92);

        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Restore MapLibre state
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);
        if (scissorEnabled) gl.enable(gl.SCISSOR_TEST);
    }

    onRemove(_map: maplibregl.Map, gl: WebGL2RenderingContext) {
        if (!this.ready) return;
        if (this.accumProg) gl.deleteProgram(this.accumProg);
        gl.deleteProgram(this.compProg);
        gl.deleteVertexArray(this.accumVAO);
        gl.deleteBuffer(this.accumVBO);
        gl.deleteBuffer(this.accumEBO);
        gl.deleteVertexArray(this.quadVAO);
        gl.deleteBuffer(this.quadVBO);
        gl.deleteFramebuffer(this.fbo);
        gl.deleteTexture(this.accTex);
        this.ready = false;
        this.fbW = this.fbH = 0;
        this.accumProg = null;
        this.accumProgFailed = false;
    }

    private _setupAccumVAO(gl: WebGL2RenderingContext) {
        gl.bindVertexArray(this.accumVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,         this.accumVBO);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.accumEBO);
        const stride = 5 * 4;
        const lPos   = gl.getAttribLocation(this.accumProg!, 'a_pos');
        const lOther = gl.getAttribLocation(this.accumProg!, 'a_other');
        const lSide  = gl.getAttribLocation(this.accumProg!, 'a_side');
        gl.enableVertexAttribArray(lPos);   gl.vertexAttribPointer(lPos,   2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(lOther); gl.vertexAttribPointer(lOther, 2, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(lSide);  gl.vertexAttribPointer(lSide,  1, gl.FLOAT, false, stride, 16);
        gl.bindVertexArray(null);
    }

    private _upload(verts: Float32Array, indices: Uint32Array) {
        const gl = this.gl;
        gl.bindVertexArray(this.accumVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,         this.accumVBO);
        gl.bufferData(gl.ARRAY_BUFFER,         verts,   gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.accumEBO);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
        gl.bindVertexArray(null);
    }

    private _ensureFBO(gl: WebGL2RenderingContext, w: number, h: number) {
        if (this.fbW === w && this.fbH === h) return;
        this.fbW = w; this.fbH = h;

        const prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D)  as WebGLTexture     | null;
        const prevFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

        gl.bindTexture(gl.TEXTURE_2D, this.accTex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

        const hasFloat = !!gl.getExtension('EXT_color_buffer_float');
        !!gl.getExtension('EXT_float_blend');
        if (hasFloat) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, null);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            this.maxCount = 1;
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accTex, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFBO);
        gl.bindTexture(gl.TEXTURE_2D, prevTex);
    }
}
