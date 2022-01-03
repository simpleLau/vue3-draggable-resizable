import Vue3DraggableResizable from "./components/vue3-draggable-resizable";

export function install(Vue) {
  if (install.installed) return;
  install.installed = true;
  Vue.component("VueDraggableResizable", Vue3DraggableResizable);
}

const plugin = {
  install,
};

let GlobalVue = null;
if (typeof window !== "undefined") {
  GlobalVue = window.Vue;
} else if (typeof global !== "undefined") {
  GlobalVue = global.Vue;
}
if (GlobalVue) {
  GlobalVue.use(plugin);
}

export default Vue3DraggableResizable;
