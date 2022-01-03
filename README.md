## 新增特征✨
- 辅助线(新)
- 元素对齐(新)
- vue3数据双向绑定
- 冲突检测
- 默认样式优化


## 说明

> 说明：组件基于[vue-draggable-resizable](https://github.com/mauricius/vue-draggable-resizable)进行二次开发

**isConflictCheck**<br/>
类型: `Boolean`<br/>必需: `false`<br/>默认: `false`

定义组件是否开启冲突检测。

```vue
<vue-draggable-resizable :is-conflict-check="true" />
```

**snap**<br/>
类型: `Boolean`<br/>
必需: `false`<br/>
默认: `false`

定义组件是否开启元素对齐。

```vue
<vue-draggable-resizable :snap="true" />
```

**snapTolerance**<br/>
类型: `Number`<br/>
必需: `false`<br/>
默认: `5`

当调用`snap`时，定义组件与元素之间的对齐距离，以像素(px)为单位。

```vue
<vue-draggable-resizable :snap="true" :snap-tolerance="20" />
```
## 新增Events
**refLineParams**<br/>
参数: params<br/>

返回参数是一个Object,里面包含`vLine`与`hLine`，具体使用可直接参考App.vue。

## 安装使用

```bash
$ npm install --save vue3-draggable-resizable
```

全局注册组件

```javascript
//main.js
import Vue from 'vue'
import vdr from 'vue-draggable-resizable'
Vue.component('vdr', vdr)
```

局部注册组件

```vue
<template>
  <div style="height: 500px; width: 500px; border: 1px solid red; position: relative;">
    <vdr :w="100" :h="100" v-on:dragging="onDrag" v-on:resizing="onResize" :parent="true">
      <p>Hello! I'm a flexible component. You can drag me around and you can resize me.<br>
      X: {{ x }} / Y: {{ y }} - Width: {{ width }} / Height: {{ height }}</p>
    </vdr>
    <vdr
        v-model:w="item.width"
        v-model:h="item.height"
        v-model:x="item.left"
        v-model:y="item.top"
        :min-width="1"
        :min-height="1"
        :parent="true"
        :debug="false"
        :snap="true"
        :snapTolerance="1"
        @refLineParams="getRefLineParams"
    >
    </vdr>
  </div>
</template>

<script>
import vdr from 'vue-draggable-resizable-gorkys'
import 'vue-draggable-resizable-gorkys/dist/VueDraggableResizable.css'
export default {
  components: {vdr},
  data: function () {
    return {
      width: 0,
      height: 0,
      x: 0,
      y: 0
    }
  },
  methods: {
    onResize: function (x, y, width, height) {
      this.x = x
      this.y = y
      this.width = width
      this.height = height
    },
    onDrag: function (x, y) {
      this.x = x
      this.y = y
    }
  }
}
</script>
```

## License

The MIT License (MIT). Please see [License File](LICENSE) for more information.
