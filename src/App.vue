<template>
  <button
    @click="
      list.push({
        id: +new Date(),
        content: form.content || +new Date(),
        type: 'div',
      })
    "
  >
    添加
  </button>
  <div class="drag-content" ref="contentRef">
    <template v-for="item in list" :key="item.id">
      <vue-draggable-resizable
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
        <component :is="item.type" v-bind="item">
          {{ item }}
        </component>
      </vue-draggable-resizable>
    </template>

    <!--辅助线-->
    <span
      class="ref-line v-line"
      v-for="item in vLine"
      :key="item.id"
      v-show="item.display"
      :style="{
        left: item.position,
        top: item.origin,
        height: item.lineLength,
      }"
    />
    <span
      class="ref-line h-line"
      v-for="item in hLine"
      :key="item.id"
      v-show="item.display"
      :style="{ top: item.position, left: item.origin, width: item.lineLength }"
    />
    <!--辅助线END-->
  </div>
  <button @click="submit">保存</button>
</template>

<script>
import VueDraggableResizable from "@/components/vue3-draggable-resizable/index.vue";
import { defineComponent, reactive, ref, toRefs } from "vue";
export default defineComponent({
  name: "content",
  components: {
    VueDraggableResizable,
  },
  setup() {
    const state = reactive({
      vLine: [],
      hLine: [],
      list: [
        {
          id: 1,
          top: 224,
          left: 776,
          style: {
            width: "100%",
            height: "100%",
          },
          type: "img",
          src: "https://v3.cn.vuejs.org/logo.png",
        },
      ],
      form: {
        content: "",
      },
    });
    const contentRef = ref(null);

    // 辅助线回调事件
    const getRefLineParams = (params) => {
      const { vLine, hLine } = params;
      let id = 0;
      state.vLine = vLine.map((item) => {
        item["id"] = ++id;
        return item;
      });
      state.hLine = hLine.map((item) => {
        item["id"] = ++id;
        return item;
      });
    };

    return {
      getRefLineParams,
      ...toRefs(state),
      contentRef,
    };
  },
});
</script>

<style scoped>
.ref-line {
  position: absolute;
  z-index: 9999;
  background-color: #1890ff;
}
.v-line {
  width: 1px;
}
.h-line {
  height: 1px;
}
.drag-content {
  position: relative;
  width: 1200px;
  height: 500px;
  margin: 0 auto;
  background-color: #eee;
}
</style>
