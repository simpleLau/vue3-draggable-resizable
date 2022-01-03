<template>
  <div
    ref="draggableResizable"
    :style="style"
    :class="[
      {
        [classNameActive]: enabled,
        [classNameDragging]: dragging,
        [classNameResizing]: resizing,
        [classNameDraggable]: draggable,
        [classNameResizable]: resizable,
      },
      className,
    ]"
    @mousedown="elementMouseDown"
    @touchstart="elementTouchDown"
  >
    <div
      v-for="handle in actualHandles"
      :key="handle"
      :class="[classNameHandle, classNameHandle + '-' + handle]"
      :style="handleStyle(handle)"
      @mousedown.stop.prevent="handleDown(handle, $event)"
      @touchstart.stop.prevent="handleTouchDown(handle, $event)"
    >
      <slot :name="handle"></slot>
    </div>
    <slot></slot>
  </div>
</template>

<script>
import {
  matchesSelectorToParentElements,
  getComputedSize,
  addEvent,
  removeEvent,
} from './utils/dom';
import { computeWidth, computeHeight, restrictToBounds, snapToGrid } from './utils/index.js';

const events = {
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup',
  },
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend',
  },
};

// 禁止用户选取
const userSelectNone = {
  userSelect: 'none',
  MozUserSelect: 'none',
  WebkitUserSelect: 'none',
  MsUserSelect: 'none',
};
// 用户选中自动
const userSelectAuto = {
  userSelect: 'auto',
  MozUserSelect: 'auto',
  WebkitUserSelect: 'auto',
  MsUserSelect: 'auto',
};

let eventsFor = events.mouse;
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue';

export default defineComponent({
  replace: true,
  name: 'vue-draggable-resizable',
  props: {
    className: {
      type: String,
      default: 'vdr',
    },
    classNameDraggable: {
      type: String,
      default: 'draggable',
    },
    classNameResizable: {
      type: String,
      default: 'resizable',
    },
    classNameDragging: {
      type: String,
      default: 'dragging',
    },
    classNameResizing: {
      type: String,
      default: 'resizing',
    },
    classNameActive: {
      type: String,
      default: 'active',
    },
    classNameHandle: {
      type: String,
      default: 'handle',
    },
    disableUserSelect: {
      type: Boolean,
      default: true,
    },
    enableNativeDrag: {
      type: Boolean,
      default: false,
    },
    preventDeactivation: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: false,
    },
    draggable: {
      type: Boolean,
      default: true,
    },
    resizable: {
      type: Boolean,
      default: true,
    },
    // 锁定宽高比
    lockAspectRatio: {
      type: Boolean,
      default: false,
    },
    w: {
      type: [Number, String],
      default: 200,
      validator: val => {
        if (typeof val === 'number') {
          return val > 0;
        }
        return val === 'auto';
      },
    },
    h: {
      type: [Number, String],
      default: 200,
      validator: val => {
        if (typeof val === 'number') {
          return val > 0;
        }
        return val === 'auto';
      },
    },
    minWidth: {
      type: Number,
      default: 0,
      validator: val => val >= 0,
    },
    minHeight: {
      type: Number,
      default: 0,
      validator: val => val >= 0,
    },
    maxWidth: {
      type: Number,
      default: null,
      validator: val => val >= 0,
    },
    maxHeight: {
      type: Number,
      default: null,
      validator: val => val >= 0,
    },
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
    z: {
      type: [String, Number],
      default: 'auto',
      validator: val => (typeof val === 'string' ? val === 'auto' : val >= 0),
    },
    handles: {
      type: Array,
      default: () => ['tl', 'tm', 'tr', 'mr', 'br', 'bm', 'bl', 'ml'],
      validator: val => {
        const s = new Set(['tl', 'tm', 'tr', 'mr', 'br', 'bm', 'bl', 'ml']);

        return new Set(val.filter(h => s.has(h))).size === val.length;
      },
    },
    dragHandle: {
      type: String,
      default: null,
    },
    dragCancel: {
      type: String,
      default: null,
    },
    axis: {
      type: String,
      default: 'both',
      validator: val => ['x', 'y', 'both'].includes(val),
    },
    grid: {
      type: Array,
      default: () => [1, 1],
    },
    parent: {
      type: [Boolean, String],
      default: false,
    },
    onDragStart: {
      type: Function,
      default: () => true,
    },
    onDrag: {
      type: Function,
      default: () => true,
    },
    onResizeStart: {
      type: Function,
      default: () => true,
    },
    onResize: {
      type: Function,
      default: () => true,
    },
    // 冲突检测
    isConflictCheck: {
      type: Boolean,
      default: false,
    },
    // 元素对齐
    snap: {
      type: Boolean,
      default: false,
    },
    // 当调用对齐时，用来设置组件与组件之间的对齐距离，以像素为单位
    snapTolerance: {
      type: Number,
      default: 5,
      validator: function (val) {
        return typeof val === 'number';
      },
    },
    // 缩放比例
    scaleRatio: {
      type: Number,
      default: 1,
      validator: val => typeof val === 'number',
    },
    // handle是否缩放
    handleInfo: {
      type: Object,
      default: () => {
        return {
          size: 8,
          offset: -5,
          switch: true,
        };
      },
    },
  },
  emits: [
    'dragging', // 拖拽中
    'resizing', // 重置大小中
    'refLineParams', // 设置辅助线
    'resizestop', // 重置大小结束
    'dragstop', // 重置结束
    'update:y',
    'update:x',
    'update:w',
    'update:h',
    'activated',
    'update:active',
    'deactivated',
  ],
  setup(props, { emit }) {
    const state = reactive({
      left: props.x,
      top: props.y,
      right: null,
      bottom: null,

      width: null,
      height: null,
      widthTouched: false,
      heightTouched: false,
      aspectFactor: null,

      parentWidth: null,
      parentHeight: null,

      minW: props.minWidth,
      minH: props.minHeight,

      maxW: props.maxWidth,
      maxH: props.maxHeight,

      handle: null,
      enabled: props.active,
      resizing: false,
      dragging: false,
      zIndex: props.z,
      // 鼠标点击位置
      mouseClickPosition: {
        mouseX: 0,
        mouseY: 0,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      },
      bounds: {
        minLeft: null,
        maxLeft: null,
        minRight: null,
        maxRight: null,
        minTop: null,
        maxTop: null,
        minBottom: null,
        maxBottom: null,
      },
    });

    const draggableResizable = ref(null);

    // 重置边界和鼠标状态
    const resetBoundsAndMouseState = () => {
      state.mouseClickPosition = { mouseX: 0, mouseY: 0, x: 0, y: 0, w: 0, h: 0 };
      state.bounds = {
        minLeft: null,
        maxLeft: null,
        minRight: null,
        maxRight: null,
        minTop: null,
        maxTop: null,
        minBottom: null,
        maxBottom: null,
      };
    };

    const validSize = () => {
      if (props.maxWidth && props.minWidth > props.maxWidth)
        console.warn('最小宽度不应该大于最大宽度');
      if (props.maxWidth && props.minHeight > props.maxHeight)
        console.warn('最小高度不能大于最大高度');
      resetBoundsAndMouseState();
    };
    validSize();

    // 检查父元素大小
    const checkParentSize = () => {
      if (props.parent) {
        const [newParentWidth, newParentHeight] = getParentSize();
        // 修复父元素改变大小后，组件resizing时活动异常
        state.right = newParentWidth - state.width - state.left;
        state.bottom = newParentHeight - state.height - state.top;

        state.parentWidth = newParentWidth;
        state.parentHeight = newParentHeight;
      }
    };

    // 获取父元素大小
    const getParentSize = () => {
      if (props.parent === true) {
        const style = window.getComputedStyle(draggableResizable.value.parentNode, null);
        return [
          parseInt(style.getPropertyValue('width'), 10),
          parseInt(style.getPropertyValue('height'), 10),
        ];
      }
      if (typeof props.parent === 'string') {
        const parentNode = document.querySelector(props.parent);
        if (!(parentNode instanceof HTMLElement)) {
          throw new Error(`The selector ${props.parent} does not match any element`);
        }
        return [parentNode.offsetWidth, parentNode.offsetHeight];
      }

      return [null, null];
    };
    // 元素触摸按下
    const elementTouchDown = e => {
      eventsFor = events.touch;
      elementDown(e);
    };
    const elementMouseDown = e => {
      eventsFor = events.mouse;
      elementDown(e);
    };
    // 元素按下
    const elementDown = e => {
      if (e instanceof MouseEvent && e.which !== 1) {
        return;
      }

      const target = e.target || e.srcElement;

      if (draggableResizable.value.contains(target)) {
        if (props.onDragStart(e) === false) {
          return;
        }

        if (
          (props.dragHandle &&
            !matchesSelectorToParentElements(target, props.dragHandle, draggableResizable.value)) ||
          (props.dragCancel &&
            matchesSelectorToParentElements(target, props.dragCancel, draggableResizable.value))
        ) {
          state.dragging = false;
          return;
        }

        if (!state.enabled) {
          state.enabled = true;
          emit('activated');
          emit('update:active', true);
        }

        if (props.draggable) {
          state.dragging = true;
        }

        state.mouseClickPosition.mouseX = e.touches ? e.touches[0].pageX : e.pageX;
        state.mouseClickPosition.mouseY = e.touches ? e.touches[0].pageY : e.pageY;

        state.mouseClickPosition.left = state.left;
        state.mouseClickPosition.right = state.right;
        state.mouseClickPosition.top = state.top;
        state.mouseClickPosition.bottom = state.bottom;
        state.mouseClickPosition.w = state.width;
        state.mouseClickPosition.h = state.height;

        if (props.parent) {
          state.bounds = calcDragLimits();
        }

        addEvent(document.documentElement, eventsFor.move, move);
        addEvent(document.documentElement, eventsFor.stop, handleUp);
      }
    };

    // 计算移动范围
    const calcDragLimits = () => {
      return {
        minLeft: state.left % props.grid[0],
        maxLeft:
          Math.floor((state.parentWidth - state.width - state.left) / props.grid[0]) *
            props.grid[0] +
          state.left,
        minRight: state.right % props.grid[0],
        maxRight:
          Math.floor((state.parentWidth - state.width - state.right) / props.grid[0]) *
            props.grid[0] +
          state.right,
        minTop: state.top % props.grid[1],
        maxTop:
          Math.floor((state.parentHeight - state.height - state.top) / props.grid[1]) *
            props.grid[1] +
          state.top,
        minBottom: state.bottom % props.grid[1],
        maxBottom:
          Math.floor((state.parentHeight - state.height - state.bottom) / props.grid[1]) *
            props.grid[1] +
          state.bottom,
      };
    };
    // 取消
    const deselect = e => {
      const target = e.target || e.srcElement;
      const regex = new RegExp(props.className + '-([trmbl]{2})', '');

      if (!draggableResizable.value.contains(target) && !regex.test(target.className)) {
        if (state.enabled && !props.preventDeactivation) {
          state.enabled = false;

          emit('deactivated');
          emit('update:active', false);
        }

        removeEvent(document.documentElement, eventsFor.move, handleResize);
      }

      resetBoundsAndMouseState();
    };
    // 控制柄触摸按下
    const handleTouchDown = (handle, e) => {
      eventsFor = events.touch;
      handleDown(handle, e);
    };

    // 控制柄按下
    const handleDown = (handle, e) => {
      if (e instanceof MouseEvent && e.which !== 1) {
        return;
      }

      if (props.onResizeStart(handle, e) === false) {
        return;
      }

      if (e.stopPropagation) e.stopPropagation();

      // Here we avoid a dangerous recursion by faking
      // corner handles as middle handles
      if (props.lockAspectRatio && !handle.includes('m')) {
        state.handle = 'm' + handle.substring(1);
      } else {
        state.handle = handle;
      }

      state.resizing = true;

      state.mouseClickPosition.mouseX = e.touches ? e.touches[0].pageX : e.pageX;
      state.mouseClickPosition.mouseY = e.touches ? e.touches[0].pageY : e.pageY;
      state.mouseClickPosition.left = state.left;
      state.mouseClickPosition.right = state.right;
      state.mouseClickPosition.top = state.top;
      state.mouseClickPosition.bottom = state.bottom;
      state.mouseClickPosition.w = state.width;
      state.mouseClickPosition.h = state.height;

      state.bounds = calcResizeLimits();

      addEvent(document.documentElement, eventsFor.move, handleResize);
      addEvent(document.documentElement, eventsFor.stop, handleUp);
    };

    /**
     * 计算调整大小范围
     **/
    const calcResizeLimits = () => {
      let minW = state.minW;
      let minH = state.minH;
      let maxW = state.maxW;
      let maxH = state.maxH;

      const aspectFactor = state.aspectFactor;
      const [gridX, gridY] = props.grid;
      const width = state.width;
      const height = state.height;
      const left = state.left;
      const top = state.top;
      const right = state.right;
      const bottom = state.bottom;

      if (props.lockAspectRatio) {
        if (minW / minH > aspectFactor) {
          minH = minW / aspectFactor;
        } else {
          minW = aspectFactor * minH;
        }

        if (maxW && maxH) {
          maxW = Math.min(maxW, aspectFactor * maxH);
          maxH = Math.min(maxH, maxW / aspectFactor);
        } else if (maxW) {
          maxH = maxW / aspectFactor;
        } else if (maxH) {
          maxW = aspectFactor * maxH;
        }
      }

      maxW = maxW - (maxW % gridX);
      maxH = maxH - (maxH % gridY);

      const limits = {
        minLeft: null,
        maxLeft: null,
        minTop: null,
        maxTop: null,
        minRight: null,
        maxRight: null,
        minBottom: null,
        maxBottom: null,
      };

      if (props.parent) {
        limits.minLeft = left % gridX;
        limits.maxLeft = left + Math.floor((width - minW) / gridX) * gridX;
        limits.minTop = top % gridY;
        limits.maxTop = top + Math.floor((height - minH) / gridY) * gridY;
        limits.minRight = right % gridX;
        limits.maxRight = right + Math.floor((width - minW) / gridX) * gridX;
        limits.minBottom = bottom % gridY;
        limits.maxBottom = bottom + Math.floor((height - minH) / gridY) * gridY;

        if (maxW) {
          limits.minLeft = Math.max(limits.minLeft, state.parentWidth - right - maxW);
          limits.minRight = Math.max(limits.minRight, state.parentWidth - left - maxW);
        }

        if (maxH) {
          limits.minTop = Math.max(limits.minTop, state.parentHeight - bottom - maxH);
          limits.minBottom = Math.max(limits.minBottom, state.parentHeight - top - maxH);
        }

        if (props.lockAspectRatio) {
          limits.minLeft = Math.max(limits.minLeft, left - top * aspectFactor);
          limits.minTop = Math.max(limits.minTop, top - left / aspectFactor);
          limits.minRight = Math.max(limits.minRight, right - bottom * aspectFactor);
          limits.minBottom = Math.max(limits.minBottom, bottom - right / aspectFactor);
        }
      } else {
        limits.minLeft = null;
        limits.maxLeft = left + Math.floor((width - minW) / gridX) * gridX;
        limits.minTop = null;
        limits.maxTop = top + Math.floor((height - minH) / gridY) * gridY;
        limits.minRight = null;
        limits.maxRight = right + Math.floor((width - minW) / gridX) * gridX;
        limits.minBottom = null;
        limits.maxBottom = bottom + Math.floor((height - minH) / gridY) * gridY;

        if (maxW) {
          limits.minLeft = -(right + maxW);
          limits.minRight = -(left + maxW);
        }

        if (maxH) {
          limits.minTop = -(bottom + maxH);
          limits.minBottom = -(top + maxH);
        }

        if (props.lockAspectRatio && maxW && maxH) {
          limits.minLeft = Math.min(limits.minLeft, -(right + maxW));
          limits.minTop = Math.min(limits.minTop, -(maxH + bottom));
          limits.minRight = Math.min(limits.minRight, -left - maxW);
          limits.minBottom = Math.min(limits.minBottom, -top - maxH);
        }
      }

      return limits;
    };
    // 移动
    const move = e => {
      if (state.resizing) {
        handleResize(e);
      } else if (state.dragging) {
        handleDrag(e);
      }
    };

    // 元素移动
    const handleDrag = async e => {
      const axis = props.axis;
      const grid = props.grid;
      const bounds = state.bounds;
      const mouseClickPosition = state.mouseClickPosition;

      const tmpDeltaX =
        axis && axis !== 'y'
          ? mouseClickPosition.mouseX - (e.touches ? e.touches[0].pageX : e.pageX)
          : 0;
      const tmpDeltaY =
        axis && axis !== 'x'
          ? mouseClickPosition.mouseY - (e.touches ? e.touches[0].pageY : e.pageY)
          : 0;

      const { x, y } = snapToGrid(grid, tmpDeltaX, tmpDeltaY, props.scaleRatio);

      const left = restrictToBounds(mouseClickPosition.left - x, bounds.minLeft, bounds.maxLeft);
      const top = restrictToBounds(mouseClickPosition.top - y, bounds.minTop, bounds.maxTop);
      if (props.onDrag(left, top) === false) {
        return;
      }
      const right = restrictToBounds(
        mouseClickPosition.right + x,
        bounds.minRight,
        bounds.maxRight
      );
      const bottom = restrictToBounds(
        mouseClickPosition.bottom + y,
        bounds.minBottom,
        bounds.maxBottom
      );
      state.left = left;
      state.top = top;
      state.right = right;
      state.bottom = bottom;

      await snapCheck();
      emit('dragging', state.left, state.top);
    };

    /**
     * 拖动横坐标
     **/
    const moveHorizontally = val => {
      const { x } = snapToGrid(props.grid, val, state.top, state.scale);
      const left = restrictToBounds(x, state.bounds.minLeft, state.bounds.maxLeft);
      state.left = left;
      state.right = state.parentWidth - state.width - left;
    };

    /**
     * 拖动纵坐标
     **/
    const moveVertically = val => {
      const { y } = snapToGrid(props.grid, state.left, val, state.scale);
      const top = restrictToBounds(y, state.bounds.minTop, state.bounds.maxTop);
      state.top = top;
      state.bottom = state.parentHeight - state.height - top;
    };

    // 控制柄移动
    const handleResize = e => {
      let left = state.left;
      let top = state.top;
      let right = state.right;
      let bottom = state.bottom;

      const mouseClickPosition = state.mouseClickPosition;
      // const lockAspectRatio = props.lockAspectRatio;
      const aspectFactor = state.aspectFactor;

      const tmpDeltaX = mouseClickPosition.mouseX - (e.touches ? e.touches[0].pageX : e.pageX);
      const tmpDeltaY = mouseClickPosition.mouseY - (e.touches ? e.touches[0].pageY : e.pageY);

      if (!state.widthTouched && tmpDeltaX) {
        state.widthTouched = true;
      }
      if (!state.heightTouched && tmpDeltaY) {
        state.heightTouched = true;
      }
      const { x, y } = snapToGrid(props.grid, tmpDeltaX, tmpDeltaY, props.scaleRatio);

      if (state.handle.includes('b')) {
        bottom = restrictToBounds(
          mouseClickPosition.bottom + y,
          state.bounds.minBottom,
          state.bounds.maxBottom
        );
        if (props.lockAspectRatio && resizingOnY) {
          right = state.right - (state.bottom - bottom) * aspectFactor;
        }
      } else if (state.handle.includes('t')) {
        top = restrictToBounds(
          mouseClickPosition.top - y,
          state.bounds.minTop,
          state.bounds.maxTop
        );
        if (props.lockAspectRatio && resizingOnY) {
          left = state.left - (state.top - top) * aspectFactor;
        }
      }

      if (state.handle.includes('r')) {
        right = restrictToBounds(
          mouseClickPosition.right + x,
          state.bounds.minRight,
          state.bounds.maxRight
        );
        if (props.lockAspectRatio && resizingOnX) {
          bottom = state.bottom - (state.right - right) / aspectFactor;
        }
      } else if (state.handle.includes('l')) {
        left = restrictToBounds(
          mouseClickPosition.left - x,
          state.bounds.minLeft,
          state.bounds.maxLeft
        );
        if (props.lockAspectRatio && resizingOnX) {
          top = state.top - (state.left - left) / aspectFactor;
        }
      }

      const width = computeWidth(state.parentWidth, left, right);
      const height = computeHeight(state.parentHeight, top, bottom);
      if (props.onResize(state.handle, left, top, width, height) === false) {
        return;
      }
      state.left = left;
      state.top = top;
      state.right = right;
      state.bottom = bottom;
      state.width = width;
      state.height = height;
      emit('resizing', state.left, state.top, state.width, state.height);
    };
    const changeWidth = val => {
      const { x } = snapToGrid(props.grid, val, 0, state.scale);
      let right = restrictToBounds(
        state.parentWidth - x - state.left,
        state.bounds.minRight,
        state.bounds.maxRight
      );
      let bottom = state.bottom;
      if (props.lockAspectRatio) {
        bottom = state.bottom - (state.right - right) / state.aspectFactor;
      }
      const width = computeWidth(state.parentWidth, state.left, right);
      const height = computeHeight(state.parentHeight, state.top, bottom);
      state.right = right;
      state.bottom = bottom;
      state.width = width;
      state.height = height;
    };
    const changeHeight = val => {
      const { y } = snapToGrid(props.grid, 0, val, state.scale);
      let bottom = restrictToBounds(
        state.parentHeight - y - state.top,
        state.bounds.minBottom,
        state.bounds.maxBottom
      );
      let right = state.right;
      if (props.lockAspectRatio) {
        right = state.right - (state.bottom - bottom) * state.aspectFactor;
      }
      const width = computeWidth(state.parentWidth, state.left, right);
      const height = computeHeight(state.parentHeight, state.top, bottom);
      state.right = right;
      state.bottom = bottom;
      state.width = width;
      state.height = height;
    };

    // 从控制柄松开
    const handleUp = async () => {
      state.handle = null;

      // 初始化辅助线数据
      const temArr = new Array(3).fill({
        display: false,
        position: '',
        origin: '',
        lineLength: '',
      });
      const refLine = { vLine: [], hLine: [] };
      for (let i in refLine) {
        refLine[i] = JSON.parse(JSON.stringify(temArr));
      }

      if (state.resizing) {
        state.resizing = false;
        conflictCheck();
        emit('refLineParams', refLine);
        emit('resizestop', state.left, state.top, state.width, state.height);
        emit('update:w', state.width);
        emit('update:h', state.height);
      }
      if (state.dragging) {
        state.dragging = false;
        conflictCheck();
        emit('refLineParams', refLine);
        emit('dragstop', state.left, state.top);
      }
      emit('update:x', state.left);
      emit('update:y', state.top);
      resetBoundsAndMouseState();
      removeEvent(document.documentElement, eventsFor.move, handleResize);
    };
    // 新增方法 ↓↓↓
    // 设置属性
    const settingAttribute = () => {
      // 设置冲突检测
      draggableResizable.value.setAttribute('data-is-check', `${props.isConflictCheck}`);
      // 设置对齐元素
      draggableResizable.value.setAttribute('data-is-snap', `${props.snap}`);
    };
    // 冲突检测
    const conflictCheck = () => {
      const top = state.top;
      const left = state.left;
      const width = state.width;
      const height = state.height;

      if (props.isConflictCheck) {
        const nodes = draggableResizable.value.parentNode.childNodes; // 获取当前父节点下所有子节点
        for (let item of nodes) {
          if (
            item.className !== undefined &&
            !item.className.includes(props.classNameActive) &&
            item.getAttribute('data-is-check') !== null &&
            item.getAttribute('data-is-check') !== 'false'
          ) {
            const tw = item.offsetWidth;
            const th = item.offsetHeight;
            // 正则获取left与right
            let [tl, tt] = formatTransformVal(item.style.transform);

            // 左上角与右下角重叠
            const tfAndBr =
              (top >= tt && left >= tl && tt + th > top && tl + tw > left) ||
              (top <= tt && left < tl && top + height > tt && left + width > tl);
            // 右上角与左下角重叠
            const brAndTf =
              (left <= tl && top >= tt && left + width > tl && top < tt + th) ||
              (top < tt && left > tl && top + height > tt && left < tl + tw);
            // 下边与上边重叠
            const bAndT =
              (top <= tt && left >= tl && top + height > tt && left < tl + tw) ||
              (top >= tt && left <= tl && top < tt + th && left > tl + tw);
            // 上边与下边重叠（宽度不一样）
            const tAndB =
              (top <= tt && left >= tl && top + height > tt && left < tl + tw) ||
              (top >= tt && left <= tl && top < tt + th && left > tl + tw);
            // 左边与右边重叠
            const lAndR =
              (left >= tl && top >= tt && left < tl + tw && top < tt + th) ||
              (top > tt && left <= tl && left + width > tl && top < tt + th);
            // 左边与右边重叠（高度不一样）
            const rAndL =
              (top <= tt && left >= tl && top + height > tt && left < tl + tw) ||
              (top >= tt && left <= tl && top < tt + th && left + width > tl);

            // 如果冲突，就将回退到移动前的位置
            if (tfAndBr || brAndTf || bAndT || tAndB || lAndR || rAndL) {
              state.top = state.mouseClickPosition.top;
              state.left = state.mouseClickPosition.left;
              state.right = state.mouseClickPosition.right;
              state.bottom = state.mouseClickPosition.bottom;
              state.width = state.mouseClickPosition.w;
              state.height = state.mouseClickPosition.h;
            }
          }
        }
      }
    };
    // 检测对齐元素
    const snapCheck = async () => {
      let width = state.width;
      let height = state.height;
      if (props.snap) {
        let activeLeft = state.left;
        let activeRight = state.left + width;
        let activeTop = state.top;
        let activeBottom = state.top + height;

        // 初始化辅助线数据
        const temArr = new Array(3).fill({
          display: false,
          position: '',
          origin: '',
          lineLength: '',
        });
        const refLine = { vLine: [], hLine: [] };
        for (let i in refLine) {
          refLine[i] = JSON.parse(JSON.stringify(temArr));
        }

        // 获取当前父节点下所有子节点
        const nodes = draggableResizable.value.parentNode.childNodes;

        let tem = {
          value: { x: [[], [], []], y: [[], [], []] },
          display: [],
          position: [],
        };
        const { groupWidth, groupHeight, groupLeft, groupTop, bln } = await getActiveAll(nodes);
        if (!bln) {
          width = groupWidth;
          height = groupHeight;
          activeLeft = groupLeft;
          activeRight = groupLeft + groupWidth;
          activeTop = groupTop;
          activeBottom = groupTop + groupHeight;
        }
        for (let item of nodes) {
          if (
            item.className !== undefined &&
            !item.className.includes(props.classNameActive) &&
            item.getAttribute('data-is-snap') !== null &&
            item.getAttribute('data-is-snap') !== 'false'
          ) {
            const w = item.offsetWidth;
            const h = item.offsetHeight;
            const [l, t] = formatTransformVal(item.style.transform);
            const r = l + w; // 对齐目标right
            const b = t + h; // 对齐目标的bottom

            const hc = Math.abs(activeTop + height / 2 - (t + h / 2)) <= props.snapTolerance; // 水平中线
            const vc = Math.abs(activeLeft + width / 2 - (l + w / 2)) <= props.snapTolerance; // 垂直中线

            const ts = Math.abs(t - activeBottom) <= props.snapTolerance; // 从上到下
            const TS = Math.abs(b - activeBottom) <= props.snapTolerance; // 从上到下
            const bs = Math.abs(t - activeTop) <= props.snapTolerance; // 从下到上
            const BS = Math.abs(b - activeTop) <= props.snapTolerance; // 从下到上

            const ls = Math.abs(l - activeRight) <= props.snapTolerance; // 外左
            const LS = Math.abs(r - activeRight) <= props.snapTolerance; // 外左
            const rs = Math.abs(l - activeLeft) <= props.snapTolerance; // 外右
            const RS = Math.abs(r - activeLeft) <= props.snapTolerance; // 外右

            tem['display'] = [ts, TS, bs, BS, hc, hc, ls, LS, rs, RS, vc, vc];
            tem['position'] = [t, b, t, b, t + h / 2, t + h / 2, l, r, l, r, l + w / 2, l + w / 2];

            if (ts) {
              if (bln) {
                state.top = t - height;
                state.bottom = state.parentHeight - state.top - height;
              }
              tem.value.y[0].push(l, r, activeLeft, activeRight);
            }
            if (bs) {
              if (bln) {
                state.top = t;
                state.bottom = state.parentHeight - state.top - height;
              }
              tem.value.y[0].push(l, r, activeLeft, activeRight);
            }
            if (TS) {
              if (bln) {
                state.top = b - height;
                state.bottom = state.parentHeight - state.top - height;
              }
              tem.value.y[1].push(l, r, activeLeft, activeRight);
            }
            if (BS) {
              if (bln) {
                state.top = b;
                state.bottom = state.parentHeight - state.top - height;
              }
              tem.value.y[1].push(l, r, activeLeft, activeRight);
            }

            if (ls) {
              if (bln) {
                state.left = l - width;
                state.right = state.parentWidth - state.left - width;
              }
              tem.value.x[0].push(t, b, activeTop, activeBottom);
            }
            if (rs) {
              if (bln) {
                state.left = l;
                state.right = state.parentWidth - state.left - width;
              }
              tem.value.x[0].push(t, b, activeTop, activeBottom);
            }
            if (LS) {
              if (bln) {
                state.left = r - width;
                state.right = state.parentWidth - state.left - width;
              }
              tem.value.x[1].push(t, b, activeTop, activeBottom);
            }
            if (RS) {
              if (bln) {
                state.left = r;
                state.right = state.parentWidth - state.left - width;
              }
              tem.value.x[1].push(t, b, activeTop, activeBottom);
            }

            if (hc) {
              if (bln) {
                state.top = t + h / 2 - height / 2;
                state.bottom = state.parentHeight - state.top - height;
              }
              tem.value.y[2].push(l, r, activeLeft, activeRight);
            }
            if (vc) {
              if (bln) {
                state.left = l + w / 2 - width / 2;
                state.right = state.parentWidth - state.left - width;
              }
              tem.value.x[2].push(t, b, activeTop, activeBottom);
            }
            // 辅助线坐标与是否显示(display)对应的数组,易于循环遍历
            const arrTem = [0, 1, 0, 1, 2, 2, 0, 1, 0, 1, 2, 2];
            for (let i = 0; i <= arrTem.length; i++) {
              // 前6为Y辅助线,后6为X辅助线
              const xory = i < 6 ? 'y' : 'x';
              const horv = i < 6 ? 'hLine' : 'vLine';
              if (tem.display[i]) {
                const { origin, length } = calcLineValues(tem.value[xory][arrTem[i]]);
                refLine[horv][arrTem[i]].display = tem.display[i];
                refLine[horv][arrTem[i]].position = tem.position[i] + 'px';
                refLine[horv][arrTem[i]].origin = origin;
                refLine[horv][arrTem[i]].lineLength = length;
              }
            }
          }
        }
        emit('refLineParams', refLine);
      }
    };
    const calcLineValues = arr => {
      const length = Math.max(...arr) - Math.min(...arr) + 'px';
      const origin = Math.min(...arr) + 'px';
      return { length, origin };
    };
    const getActiveAll = async nodes => {
      const activeAll = [];
      const XArray = [];
      const YArray = [];
      let groupWidth = 0;
      let groupHeight = 0;
      let groupLeft = 0;
      let groupTop = 0;
      for (let item of nodes) {
        if (item.className !== undefined && item.className.includes(props.classNameActive)) {
          activeAll.push(item);
        }
      }
      const AllLength = activeAll.length;
      if (AllLength > 1) {
        for (let i of activeAll) {
          const l = i.offsetLeft;
          const r = l + i.offsetWidth;
          const t = i.offsetTop;
          const b = t + i.offsetHeight;
          XArray.push(t, b);
          YArray.push(l, r);
        }
        groupWidth = Math.max(...YArray) - Math.min(...YArray);
        groupHeight = Math.max(...XArray) - Math.min(...XArray);
        groupLeft = Math.min(...YArray);
        groupTop = Math.min(...XArray);
      }
      const bln = AllLength === 1;
      return { groupWidth, groupHeight, groupLeft, groupTop, bln };
    };

    // 正则获取left与top
    const formatTransformVal = string => {
      let [left, top] = string.replace(/[^0-9\-,]/g, '').split(',');
      if (top === undefined) top = 0;
      return [+left, +top];
    };

    onMounted(() => {
      if (!props.enableNativeDrag) {
        draggableResizable.value.ondragstart = () => false;
      }

      const [parentWidth, parentHeight] = getParentSize();

      state.parentWidth = parentWidth;
      state.parentHeight = parentHeight;
      const [width, height] = getComputedSize(draggableResizable.value);
      state.aspectFactor =
        (props.w !== 'auto' ? props.w : width) / (props.h !== 'auto' ? props.h : height);
      state.width = props.w !== 'auto' ? props.w : width;
      state.height = props.h !== 'auto' ? props.h : height;
      state.right = state.parentWidth - state.width - state.left;
      state.bottom = state.parentHeight - state.height - state.top;

      settingAttribute();

      addEvent(document.documentElement, 'mousedown', deselect);
      addEvent(document.documentElement, 'touchend touchcancel', deselect);

      addEvent(window, 'resize', checkParentSize);
    });

    onBeforeUnmount(() => {
      removeEvent(document.documentElement, 'mousedown', deselect);
      removeEvent(document.documentElement, 'touchstart', handleUp);
      removeEvent(document.documentElement, 'mousemove', move);
      removeEvent(document.documentElement, 'touchmove', move);
      removeEvent(document.documentElement, 'mouseup', handleUp);
      removeEvent(document.documentElement, 'touchend touchcancel', deselect);
      removeEvent(window, 'resize', checkParentSize);
    });

    const handleStyle = computed(() => {
      return stick => {
        if (!props.handleInfo.switch) return { display: state.enabled ? 'block' : 'none' };
        const size = (props.handleInfo.size / props.scaleRatio).toFixed(2);
        const offset = (props.handleInfo.offset / props.scaleRatio).toFixed(2);
        const center = (size / 2).toFixed(2);

        const styleMap = {
          tl: {
            top: `${offset}px`,
            left: `${offset}px`,
          },
          tm: {
            top: `${offset}px`,
            left: `calc(50% - ${center}px)`,
          },
          tr: {
            top: `${offset}px`,
            right: `${offset}px`,
          },
          mr: {
            top: `calc(50% - ${center}px)`,
            right: `${offset}px`,
          },
          br: {
            bottom: `${offset}px`,
            right: `${offset}px`,
          },
          bm: {
            bottom: `${offset}px`,
            right: `calc(50% - ${center}px)`,
          },
          bl: {
            bottom: `${offset}px`,
            left: `${offset}px`,
          },
          ml: {
            top: `calc(50% - ${center}px)`,
            left: `${offset}px`,
          },
        };
        const stickStyle = {
          width: `${size}px`,
          height: `${size}px`,
          top: styleMap[stick].top,
          left: styleMap[stick].left,
          right: styleMap[stick].right,
          bottom: styleMap[stick].bottom,
        };
        stickStyle.display = state.enabled ? 'block' : 'none';
        return stickStyle;
      };
    });

    /**
     * div行内样式
     **/
    const style = computed(() => {
      return {
        transform: `translate(${state.left}px, ${state.top}px)`,
        width: computedWidth.value,
        height: computedHeight.value,
        zIndex: state.zIndex,
        ...(state.dragging && props.disableUserSelect ? userSelectNone : userSelectAuto),
      };
    });
    // 控制柄显示与否
    const actualHandles = computed(() => {
      if (!props.resizable) return [];

      return props.handles;
    });

    const computedWidth = computed(() => {
      if (props.w === 'auto') {
        if (!state.widthTouched) {
          return 'auto';
        }
      }
      return state.width + 'px';
    });

    const computedHeight = computed(() => {
      if (props.h === 'auto') {
        if (!state.heightTouched) {
          return 'auto';
        }
      }
      return state.height + 'px';
    });

    const resizingOnX = computed(() => {
      return Boolean(state.handle) && (state.handle.includes('l') || state.handle.includes('r'));
    });

    const resizingOnY = computed(() => {
      return Boolean(state.handle) && (state.handle.includes('t') || state.handle.includes('b'));
    });

    watch(
      () => props.active,
      key => {
        state.enabled = key;
        key ? emit('activated') : emit('deactivated');
      }
    );

    watch(
      () => props.z,
      key => {
        if (key >= 0 || key === 'auto') {
          state.zIndex = key;
        }
      }
    );

    watch(
      () => props.x,
      key => {
        if (state.resizing || state.dragging) return;
        if (props.parent) state.bounds = calcDragLimits();
        moveHorizontally(key);
      }
    );

    watch(
      () => props.y,
      key => {
        if (state.resizing || state.dragging) return;
        if (props.parent) state.bounds = calcDragLimits();
        moveVertically(key);
      }
    );

    watch(
      () => props.lockAspectRatio,
      key => {
        key ? (state.aspectFactor = state.width / state.height) : (state.aspectFactor = undefined);
      }
    );

    watch(
      () => props.minWidth,
      key => {
        if (key > 0 && key <= state.width) {
          state.minW = key;
        }
      }
    );

    watch(
      () => props.minHeight,
      key => {
        if (key > 0 && key <= state.height) {
          state.minH = key;
        }
      }
    );

    watch(
      () => props.maxWidth,
      key => {
        state.maxW = key;
      }
    );

    watch(
      () => props.maxHeight,
      key => {
        state.maxH = key;
      }
    );

    watch(
      () => props.w,
      key => {
        if (state.resizing || state.dragging) return;
        if (props.parent) state.bounds = calcResizeLimits();
        changeWidth(key);
      }
    );

    watch(
      () => props.h,
      key => {
        if (state.resizing || state.dragging) return;
        if (props.parent) state.bounds = calcResizeLimits();
        changeHeight(key);
      }
    );

    return {
      ...toRefs(state),
      elementTouchDown,
      elementMouseDown,
      style,
      handleTouchDown,
      actualHandles,
      handleStyle,
      draggableResizable,
      handleDown,
    };
  },
});
</script>

<style scoped>
@import url('./style/index.css');
</style>