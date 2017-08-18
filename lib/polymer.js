"use strict";

(function () {
    "use strict";

    const userPolymer = window.Polymer;
    window.Polymer = function (info) {
        return window.Polymer._polymerFn(info);
    };
    if (userPolymer) {
        Object.assign(Polymer, userPolymer);
    }
    window.Polymer._polymerFn = function (info) {
        throw new Error("Load polymer.html to use the Polymer() function.");
    };
    window.Polymer.version = "2.0.1";
    window.JSCompiler_renameProperty = function (prop, obj) {
        return prop;
    };
})();

(function () {
    "use strict";

    let CSS_URL_RX = /(url\()([^)]*)(\))/g;
    let ABS_URL = /(^\/)|(^#)|(^[\w-\d]*:)/;
    let workingURL;
    let resolveDoc;
    function resolveUrl(url, baseURI) {
        if (url && ABS_URL.test(url)) {
            return url;
        }
        if (workingURL === undefined) {
            workingURL = false;
            try {
                const u = new URL("b", "http://a");
                u.pathname = "c%20d";
                workingURL = u.href === "http://a/c%20d";
            } catch (e) {}
        }
        if (!baseURI) {
            baseURI = document.baseURI || window.location.href;
        }
        if (workingURL) {
            return new URL(url, baseURI).href;
        }
        if (!resolveDoc) {
            resolveDoc = document.implementation.createHTMLDocument("temp");
            resolveDoc.base = resolveDoc.createElement("base");
            resolveDoc.head.appendChild(resolveDoc.base);
            resolveDoc.anchor = resolveDoc.createElement("a");
            resolveDoc.body.appendChild(resolveDoc.anchor);
        }
        resolveDoc.base.href = baseURI;
        resolveDoc.anchor.href = url;
        return resolveDoc.anchor.href || url;
    }
    function resolveCss(cssText, baseURI) {
        return cssText.replace(CSS_URL_RX, function (m, pre, url, post) {
            return pre + "'" + resolveUrl(url.replace(/["']/g, ""), baseURI) + "'" + post;
        });
    }
    function pathFromUrl(url) {
        return url.substring(0, url.lastIndexOf("/") + 1);
    }
    Polymer.ResolveUrl = {
        resolveCss: resolveCss,
        resolveUrl: resolveUrl,
        pathFromUrl: pathFromUrl
    };
})();

(function () {
    "use strict";

    const settings = Polymer.Settings || {};
    settings.useShadow = !window.ShadyDOM;
    settings.useNativeCSSProperties = Boolean(!window.ShadyCSS || window.ShadyCSS.nativeCss);
    settings.useNativeCustomElements = !window.customElements.polyfillWrapFlushCallback;
    Polymer.Settings = settings;
    let rootPath = Polymer.rootPath || Polymer.ResolveUrl.pathFromUrl(document.baseURI || window.location.href);
    Polymer.rootPath = rootPath;
    Polymer.setRootPath = function (path) {
        Polymer.rootPath = path;
    };
})();

(function () {
    "use strict";

    let dedupeId = 0;
    function MixinFunction() {}
    MixinFunction.prototype.__mixinApplications;
    MixinFunction.prototype.__mixinSet;
    Polymer.dedupingMixin = function (mixin) {
        let mixinApplications = mixin.__mixinApplications;
        if (!mixinApplications) {
            mixinApplications = new WeakMap();
            mixin.__mixinApplications = mixinApplications;
        }
        let mixinDedupeId = dedupeId++;
        function dedupingMixin(base) {
            let baseSet = base.__mixinSet;
            if (baseSet && baseSet[mixinDedupeId]) {
                return base;
            }
            let map = mixinApplications;
            let extended = map.get(base);
            if (!extended) {
                extended = mixin(base);
                map.set(base, extended);
            }
            let mixinSet = Object.create(extended.__mixinSet || baseSet || null);
            mixinSet[mixinDedupeId] = true;
            extended.__mixinSet = mixinSet;
            return extended;
        }
        return dedupingMixin;
    };
})();

(function () {
    "use strict";

    const caseMap = {};
    const DASH_TO_CAMEL = /-[a-z]/g;
    const CAMEL_TO_DASH = /([A-Z])/g;
    const CaseMap = {
        dashToCamelCase(dash) {
            return caseMap[dash] || (caseMap[dash] = dash.indexOf("-") < 0 ? dash : dash.replace(DASH_TO_CAMEL, m => m[1].toUpperCase()));
        },
        camelToDashCase(camel) {
            return caseMap[camel] || (caseMap[camel] = camel.replace(CAMEL_TO_DASH, "-$1").toLowerCase());
        }
    };
    Polymer.CaseMap = CaseMap;
})();

(function () {
    "use strict";

    const MODULE_STYLE_LINK_SELECTOR = "link[rel=import][type~=css]";
    const INCLUDE_ATTR = "include";
    function importModule(moduleId) {
        if (!Polymer.DomModule) {
            return null;
        }
        return Polymer.DomModule.import(moduleId);
    }
    let templateWithAssetPath;
    const StyleGather = {
        cssFromModules(moduleIds) {
            let modules = moduleIds.trim().split(" ");
            let cssText = "";
            for (let i = 0; i < modules.length; i++) {
                cssText += this.cssFromModule(modules[i]);
            }
            return cssText;
        },
        cssFromModule(moduleId) {
            let m = importModule(moduleId);
            if (m && m._cssText === undefined) {
                let cssText = "";
                let t = m.querySelector("template");
                if (t) {
                    cssText += this.cssFromTemplate(t, m.assetpath);
                }
                cssText += this.cssFromModuleImports(moduleId);
                m._cssText = cssText || null;
            }
            if (!m) {
                console.warn("Could not find style data in module named", moduleId);
            }
            return m && m._cssText || "";
        },
        cssFromTemplate(template, baseURI) {
            let cssText = "";
            let e$ = template.content.querySelectorAll("style");
            for (let i = 0; i < e$.length; i++) {
                let e = e$[i];
                let include = e.getAttribute(INCLUDE_ATTR);
                if (include) {
                    cssText += this.cssFromModules(include);
                }
                e.parentNode.removeChild(e);
                cssText += baseURI ? Polymer.ResolveUrl.resolveCss(e.textContent, baseURI) : e.textContent;
            }
            return cssText;
        },
        cssFromModuleImports(moduleId) {
            let cssText = "";
            let m = importModule(moduleId);
            if (!m) {
                return cssText;
            }
            let p$ = m.querySelectorAll(MODULE_STYLE_LINK_SELECTOR);
            for (let i = 0; i < p$.length; i++) {
                let p = p$[i];
                if (p.import) {
                    let importDoc = p.import;
                    let container = importDoc.body ? importDoc.body : importDoc;
                    cssText += Polymer.ResolveUrl.resolveCss(container.textContent, importDoc.baseURI);
                }
            }
            return cssText;
        }
    };
    Polymer.StyleGather = StyleGather;
})();

(function () {
    "use strict";

    let modules = {};
    let lcModules = {};
    function findModule(id) {
        return modules[id] || lcModules[id.toLowerCase()];
    }
    function styleOutsideTemplateCheck(inst) {
        if (inst.querySelector("style")) {
            console.warn("dom-module %s has style outside template", inst.id);
        }
    }
    class DomModule extends HTMLElement {
        static get observedAttributes() {
            return ["id"];
        }
        static import(id, selector) {
            if (id) {
                let m = findModule(id);
                if (m && selector) {
                    return m.querySelector(selector);
                }
                return m;
            }
            return null;
        }
        attributeChangedCallback(name, old, value) {
            if (old !== value) {
                this.register();
            }
        }
        get assetpath() {
            if (!this.__assetpath) {
                const owner = window.HTMLImports && HTMLImports.importForElement ? HTMLImports.importForElement(this) || document : this.ownerDocument;
                const url = Polymer.ResolveUrl.resolveUrl(this.getAttribute("assetpath") || "", owner.baseURI);
                this.__assetpath = Polymer.ResolveUrl.pathFromUrl(url);
            }
            return this.__assetpath;
        }
        register(id) {
            id = id || this.id;
            if (id) {
                this.id = id;
                modules[id] = this;
                lcModules[id.toLowerCase()] = this;
                styleOutsideTemplateCheck(this);
            }
        }
    }
    DomModule.prototype["modules"] = modules;
    customElements.define("dom-module", DomModule);
    Polymer.DomModule = DomModule;
})();

(function () {
    "use strict";

    const Path = {
        isPath: function (path) {
            return path.indexOf(".") >= 0;
        },
        root: function (path) {
            let dotIndex = path.indexOf(".");
            if (dotIndex === -1) {
                return path;
            }
            return path.slice(0, dotIndex);
        },
        isAncestor: function (base, path) {
            return base.indexOf(path + ".") === 0;
        },
        isDescendant: function (base, path) {
            return path.indexOf(base + ".") === 0;
        },
        translate: function (base, newBase, path) {
            return newBase + path.slice(base.length);
        },
        matches: function (base, path) {
            return base === path || this.isAncestor(base, path) || this.isDescendant(base, path);
        },
        normalize: function (path) {
            if (Array.isArray(path)) {
                let parts = [];
                for (let i = 0; i < path.length; i++) {
                    let args = path[i].toString().split(".");
                    for (let j = 0; j < args.length; j++) {
                        parts.push(args[j]);
                    }
                }
                return parts.join(".");
            } else {
                return path;
            }
        },
        split: function (path) {
            if (Array.isArray(path)) {
                return this.normalize(path).split(".");
            }
            return path.toString().split(".");
        },
        get: function (root, path, info) {
            let prop = root;
            let parts = this.split(path);
            for (let i = 0; i < parts.length; i++) {
                if (!prop) {
                    return;
                }
                let part = parts[i];
                prop = prop[part];
            }
            if (info) {
                info.path = parts.join(".");
            }
            return prop;
        },
        set: function (root, path, value) {
            let prop = root;
            let parts = this.split(path);
            let last = parts[parts.length - 1];
            if (parts.length > 1) {
                for (let i = 0; i < parts.length - 1; i++) {
                    let part = parts[i];
                    prop = prop[part];
                    if (!prop) {
                        return;
                    }
                }
                prop[last] = value;
            } else {
                prop[path] = value;
            }
            return parts.join(".");
        }
    };
    Path.isDeep = Path.isPath;
    Polymer.Path = Path;
})();

(function () {
    "use strict";

    let AsyncInterface;
    let microtaskCurrHandle = 0;
    let microtaskLastHandle = 0;
    let microtaskCallbacks = [];
    let microtaskNodeContent = 0;
    let microtaskNode = document.createTextNode("");
    new window.MutationObserver(microtaskFlush).observe(microtaskNode, {
        characterData: true
    });
    function microtaskFlush() {
        const len = microtaskCallbacks.length;
        for (let i = 0; i < len; i++) {
            let cb = microtaskCallbacks[i];
            if (cb) {
                try {
                    cb();
                } catch (e) {
                    setTimeout(() => {
                        throw e;
                    });
                }
            }
        }
        microtaskCallbacks.splice(0, len);
        microtaskLastHandle += len;
    }
    Polymer.Async = {
        timeOut: {
            after(delay) {
                return {
                    run(fn) {
                        return setTimeout(fn, delay);
                    },
                    cancel: window.clearTimeout.bind(window)
                };
            },
            run: window.setTimeout.bind(window),
            cancel: window.clearTimeout.bind(window)
        },
        animationFrame: {
            run: window.requestAnimationFrame.bind(window),
            cancel: window.cancelAnimationFrame.bind(window)
        },
        idlePeriod: {
            run(fn) {
                return window.requestIdleCallback ? window.requestIdleCallback(fn) : window.setTimeout(fn, 16);
            },
            cancel(handle) {
                window.cancelIdleCallback ? window.cancelIdleCallback(handle) : window.clearTimeout(handle);
            }
        },
        microTask: {
            run(callback) {
                microtaskNode.textContent = microtaskNodeContent++;
                microtaskCallbacks.push(callback);
                return microtaskCurrHandle++;
            },
            cancel(handle) {
                const idx = handle - microtaskLastHandle;
                if (idx >= 0) {
                    if (!microtaskCallbacks[idx]) {
                        throw new Error("invalid async handle: " + handle);
                    }
                    microtaskCallbacks[idx] = null;
                }
            }
        }
    };
})();

(function () {
    "use strict";

    let caseMap = Polymer.CaseMap;
    let microtask = Polymer.Async.microTask;
    const nativeProperties = {};
    let proto = HTMLElement.prototype;
    while (proto) {
        let props = Object.getOwnPropertyNames(proto);
        for (let i = 0; i < props.length; i++) {
            nativeProperties[props[i]] = true;
        }
        proto = Object.getPrototypeOf(proto);
    }
    function saveAccessorValue(model, property) {
        if (!nativeProperties[property]) {
            let value = model[property];
            if (value !== undefined) {
                if (model.__data) {
                    model._setPendingProperty(property, value);
                } else {
                    if (!model.__dataProto) {
                        model.__dataProto = {};
                    } else if (!model.hasOwnProperty(JSCompiler_renameProperty("__dataProto", model))) {
                        model.__dataProto = Object.create(model.__dataProto);
                    }
                    model.__dataProto[property] = value;
                }
            }
        }
    }
    Polymer.PropertyAccessors = Polymer.dedupingMixin(superClass => {
        class PropertyAccessors extends superClass {
            static createPropertiesForAttributes() {
                let a$ = this.observedAttributes;
                for (let i = 0; i < a$.length; i++) {
                    this.prototype._createPropertyAccessor(caseMap.dashToCamelCase(a$[i]));
                }
            }
            constructor() {
                super();
                this.__serializing;
                this.__dataCounter;
                this.__dataEnabled;
                this.__dataReady;
                this.__dataInvalid;
                this.__data;
                this.__dataPending;
                this.__dataOld;
                this.__dataProto;
                this.__dataHasAccessor;
                this.__dataInstanceProps;
                this._initializeProperties();
            }
            attributeChangedCallback(name, old, value) {
                if (old !== value) {
                    this._attributeToProperty(name, value);
                }
            }
            _initializeProperties() {
                this.__serializing = false;
                this.__dataCounter = 0;
                this.__dataEnabled = false;
                this.__dataReady = false;
                this.__dataInvalid = false;
                this.__data = {};
                this.__dataPending = null;
                this.__dataOld = null;
                if (this.__dataProto) {
                    this._initializeProtoProperties(this.__dataProto);
                    this.__dataProto = null;
                }
                for (let p in this.__dataHasAccessor) {
                    if (this.hasOwnProperty(p)) {
                        this.__dataInstanceProps = this.__dataInstanceProps || {};
                        this.__dataInstanceProps[p] = this[p];
                        delete this[p];
                    }
                }
            }
            _initializeProtoProperties(props) {
                for (let p in props) {
                    this._setProperty(p, props[p]);
                }
            }
            _initializeInstanceProperties(props) {
                Object.assign(this, props);
            }
            _ensureAttribute(attribute, value) {
                if (!this.hasAttribute(attribute)) {
                    this._valueToNodeAttribute(this, value, attribute);
                }
            }
            _attributeToProperty(attribute, value, type) {
                if (!this.__serializing) {
                    let property = caseMap.dashToCamelCase(attribute);
                    this[property] = this._deserializeValue(value, type);
                }
            }
            _propertyToAttribute(property, attribute, value) {
                this.__serializing = true;
                value = arguments.length < 3 ? this[property] : value;
                this._valueToNodeAttribute(this, value, attribute || caseMap.camelToDashCase(property));
                this.__serializing = false;
            }
            _valueToNodeAttribute(node, value, attribute) {
                let str = this._serializeValue(value);
                if (str === undefined) {
                    node.removeAttribute(attribute);
                } else {
                    node.setAttribute(attribute, str);
                }
            }
            _serializeValue(value) {
                switch (typeof value) {
                    case "boolean":
                        return value ? "" : undefined;

                    case "object":
                        if (value instanceof Date) {
                            return value.toString();
                        } else if (value) {
                            try {
                                return JSON.stringify(value);
                            } catch (x) {
                                return "";
                            }
                        }

                    default:
                        return value != null ? value.toString() : undefined;
                }
            }
            _deserializeValue(value, type) {
                let outValue;
                switch (type) {
                    case Number:
                        outValue = Number(value);
                        break;

                    case Boolean:
                        outValue = value !== null;
                        break;

                    case Object:
                        try {
                            outValue = JSON.parse(value);
                        } catch (x) {}
                        break;

                    case Array:
                        try {
                            outValue = JSON.parse(value);
                        } catch (x) {
                            outValue = null;
                            console.warn(`Polymer::Attributes: couldn't decode Array as JSON: ${value}`);
                        }
                        break;

                    case Date:
                        outValue = new Date(value);
                        break;

                    case String:
                    default:
                        outValue = value;
                        break;
                }
                return outValue;
            }
            _createPropertyAccessor(property, readOnly) {
                if (!this.hasOwnProperty("__dataHasAccessor")) {
                    this.__dataHasAccessor = Object.assign({}, this.__dataHasAccessor);
                }
                if (!this.__dataHasAccessor[property]) {
                    this.__dataHasAccessor[property] = true;
                    saveAccessorValue(this, property);
                    Object.defineProperty(this, property, {
                        get: function () {
                            return this.__data[property];
                        },
                        set: readOnly ? function () {} : function (value) {
                            this._setProperty(property, value);
                        }
                    });
                }
            }
            _hasAccessor(property) {
                return this.__dataHasAccessor && this.__dataHasAccessor[property];
            }
            _setProperty(property, value) {
                if (this._setPendingProperty(property, value)) {
                    this._invalidateProperties();
                }
            }
            _setPendingProperty(property, value) {
                let old = this.__data[property];
                let changed = this._shouldPropertyChange(property, value, old);
                if (changed) {
                    if (!this.__dataPending) {
                        this.__dataPending = {};
                        this.__dataOld = {};
                    }
                    if (this.__dataOld && !(property in this.__dataOld)) {
                        this.__dataOld[property] = old;
                    }
                    this.__data[property] = value;
                    this.__dataPending[property] = value;
                }
                return changed;
            }
            _isPropertyPending(prop) {
                return Boolean(this.__dataPending && prop in this.__dataPending);
            }
            _invalidateProperties() {
                if (!this.__dataInvalid && this.__dataReady) {
                    this.__dataInvalid = true;
                    microtask.run(() => {
                        if (this.__dataInvalid) {
                            this.__dataInvalid = false;
                            this._flushProperties();
                        }
                    });
                }
            }
            _enableProperties() {
                if (!this.__dataEnabled) {
                    this.__dataEnabled = true;
                    if (this.__dataInstanceProps) {
                        this._initializeInstanceProperties(this.__dataInstanceProps);
                        this.__dataInstanceProps = null;
                    }
                    this.ready();
                }
            }
            _flushProperties() {
                if (this.__dataPending && this.__dataOld) {
                    let changedProps = this.__dataPending;
                    this.__dataPending = null;
                    this.__dataCounter++;
                    this._propertiesChanged(this.__data, changedProps, this.__dataOld);
                    this.__dataCounter--;
                }
            }
            ready() {
                this.__dataReady = true;
                this._flushProperties();
            }
            _propertiesChanged(currentProps, changedProps, oldProps) {}
            _shouldPropertyChange(property, value, old) {
                return old !== value && (old === old || value === value);
            }
        }
        return PropertyAccessors;
    });
})();

(function () {
    "use strict";

    const templateExtensions = {
        "dom-if": true,
        "dom-repeat": true
    };
    function wrapTemplateExtension(node) {
        let is = node.getAttribute("is");
        if (is && templateExtensions[is]) {
            let t = node;
            t.removeAttribute("is");
            node = t.ownerDocument.createElement(is);
            t.parentNode.replaceChild(node, t);
            node.appendChild(t);
            while (t.attributes.length) {
                node.setAttribute(t.attributes[0].name, t.attributes[0].value);
                t.removeAttribute(t.attributes[0].name);
            }
        }
        return node;
    }
    function findTemplateNode(root, nodeInfo) {
        let parent = nodeInfo.parentInfo && findTemplateNode(root, nodeInfo.parentInfo);
        if (parent) {
            for (let n = parent.firstChild, i = 0; n; n = n.nextSibling) {
                if (nodeInfo.parentIndex === i++) {
                    return n;
                }
            }
        } else {
            return root;
        }
    }
    function applyIdToMap(inst, map, node, nodeInfo) {
        if (nodeInfo.id) {
            map[nodeInfo.id] = node;
        }
    }
    function applyEventListener(inst, node, nodeInfo) {
        if (nodeInfo.events && nodeInfo.events.length) {
            for (let j = 0, e$ = nodeInfo.events, e; j < e$.length && (e = e$[j]); j++) {
                inst._addMethodEventListenerToNode(node, e.name, e.value, inst);
            }
        }
    }
    function applyTemplateContent(inst, node, nodeInfo) {
        if (nodeInfo.templateInfo) {
            node._templateInfo = nodeInfo.templateInfo;
        }
    }
    function createNodeEventHandler(context, eventName, methodName) {
        context = context._methodHost || context;
        let handler = function (e) {
            if (context[methodName]) {
                context[methodName](e, e.detail);
            } else {
                console.warn("listener method `" + methodName + "` not defined");
            }
        };
        return handler;
    }
    Polymer.TemplateStamp = Polymer.dedupingMixin(superClass => {
        class TemplateStamp extends superClass {
            static _parseTemplate(template, outerTemplateInfo) {
                if (!template._templateInfo) {
                    let templateInfo = template._templateInfo = {};
                    templateInfo.nodeInfoList = [];
                    templateInfo.stripWhiteSpace = outerTemplateInfo && outerTemplateInfo.stripWhiteSpace || template.hasAttribute("strip-whitespace");
                    this._parseTemplateContent(template, templateInfo, {
                        parent: null
                    });
                }
                return template._templateInfo;
            }
            static _parseTemplateContent(template, templateInfo, nodeInfo) {
                return this._parseTemplateNode(template.content, templateInfo, nodeInfo);
            }
            static _parseTemplateNode(node, templateInfo, nodeInfo) {
                let noted;
                let element = node;
                if (element.localName == "template" && !element.hasAttribute("preserve-content")) {
                    noted = this._parseTemplateNestedTemplate(element, templateInfo, nodeInfo) || noted;
                } else if (element.localName === "slot") {
                    templateInfo.hasInsertionPoint = true;
                }
                if (element.firstChild) {
                    noted = this._parseTemplateChildNodes(element, templateInfo, nodeInfo) || noted;
                }
                if (element.hasAttributes && element.hasAttributes()) {
                    noted = this._parseTemplateNodeAttributes(element, templateInfo, nodeInfo) || noted;
                }
                return noted;
            }
            static _parseTemplateChildNodes(root, templateInfo, nodeInfo) {
                for (let node = root.firstChild, parentIndex = 0, next; node; node = next) {
                    if (node.localName == "template") {
                        node = wrapTemplateExtension(node);
                    }
                    next = node.nextSibling;
                    if (node.nodeType === Node.TEXT_NODE) {
                        let n = next;
                        while (n && n.nodeType === Node.TEXT_NODE) {
                            node.textContent += n.textContent;
                            next = n.nextSibling;
                            root.removeChild(n);
                            n = next;
                        }
                        if (templateInfo.stripWhiteSpace && !node.textContent.trim()) {
                            root.removeChild(node);
                            continue;
                        }
                    }
                    let childInfo = {
                        parentIndex: parentIndex,
                        parentInfo: nodeInfo
                    };
                    if (this._parseTemplateNode(node, templateInfo, childInfo)) {
                        childInfo.infoIndex = templateInfo.nodeInfoList.push(childInfo) - 1;
                    }
                    if (node.parentNode) {
                        parentIndex++;
                    }
                }
            }
            static _parseTemplateNestedTemplate(node, outerTemplateInfo, nodeInfo) {
                let templateInfo = this._parseTemplate(node, outerTemplateInfo);
                let content = templateInfo.content = node.content.ownerDocument.createDocumentFragment();
                content.appendChild(node.content);
                nodeInfo.templateInfo = templateInfo;
                return true;
            }
            static _parseTemplateNodeAttributes(node, templateInfo, nodeInfo) {
                let noted = false;
                let attrs = Array.from(node.attributes);
                for (let i = attrs.length - 1, a; a = attrs[i]; i--) {
                    noted = this._parseTemplateNodeAttribute(node, templateInfo, nodeInfo, a.name, a.value) || noted;
                }
                return noted;
            }
            static _parseTemplateNodeAttribute(node, templateInfo, nodeInfo, name, value) {
                if (name.slice(0, 3) === "on-") {
                    node.removeAttribute(name);
                    nodeInfo.events = nodeInfo.events || [];
                    nodeInfo.events.push({
                        name: name.slice(3),
                        value: value
                    });
                    return true;
                } else if (name === "id") {
                    nodeInfo.id = value;
                    return true;
                }
                return false;
            }
            static _contentForTemplate(template) {
                let templateInfo = template._templateInfo;
                return templateInfo && templateInfo.content || template.content;
            }
            _stampTemplate(template) {
                if (template && !template.content && window.HTMLTemplateElement && HTMLTemplateElement.decorate) {
                    HTMLTemplateElement.decorate(template);
                }
                let templateInfo = this.constructor._parseTemplate(template);
                let nodeInfo = templateInfo.nodeInfoList;
                let content = templateInfo.content || template.content;
                let dom = document.importNode(content, true);
                dom.__noInsertionPoint = !templateInfo.hasInsertionPoint;
                let nodes = dom.nodeList = new Array(nodeInfo.length);
                dom.$ = {};
                for (let i = 0, l = nodeInfo.length, info; i < l && (info = nodeInfo[i]); i++) {
                    let node = nodes[i] = findTemplateNode(dom, info);
                    applyIdToMap(this, dom.$, node, info);
                    applyTemplateContent(this, node, info);
                    applyEventListener(this, node, info);
                }
                return dom;
            }
            _addMethodEventListenerToNode(node, eventName, methodName, context) {
                context = context || node;
                let handler = createNodeEventHandler(context, eventName, methodName);
                this._addEventListenerToNode(node, eventName, handler);
                return handler;
            }
            _addEventListenerToNode(node, eventName, handler) {
                node.addEventListener(eventName, handler);
            }
            _removeEventListenerFromNode(node, eventName, handler) {
                node.removeEventListener(eventName, handler);
            }
        }
        return TemplateStamp;
    });
})();

(function () {
    "use strict";

    const CaseMap = Polymer.CaseMap;
    let dedupeId = 0;
    const TYPES = {
        COMPUTE: "__computeEffects",
        REFLECT: "__reflectEffects",
        NOTIFY: "__notifyEffects",
        PROPAGATE: "__propagateEffects",
        OBSERVE: "__observeEffects",
        READ_ONLY: "__readOnly"
    };
    let DataTrigger;
    let DataEffect;
    let PropertyEffectsType;
    function ensureOwnEffectMap(model, type) {
        let effects = model[type];
        if (!effects) {
            effects = model[type] = {};
        } else if (!model.hasOwnProperty(type)) {
            effects = model[type] = Object.create(model[type]);
            for (let p in effects) {
                let protoFx = effects[p];
                let instFx = effects[p] = Array(protoFx.length);
                for (let i = 0; i < protoFx.length; i++) {
                    instFx[i] = protoFx[i];
                }
            }
        }
        return effects;
    }
    function runEffects(inst, effects, props, oldProps, hasPaths, extraArgs) {
        if (effects) {
            let ran = false;
            let id = dedupeId++;
            for (let prop in props) {
                if (runEffectsForProperty(inst, effects, id, prop, props, oldProps, hasPaths, extraArgs)) {
                    ran = true;
                }
            }
            return ran;
        }
        return false;
    }
    function runEffectsForProperty(inst, effects, dedupeId, prop, props, oldProps, hasPaths, extraArgs) {
        let ran = false;
        let rootProperty = hasPaths ? Polymer.Path.root(prop) : prop;
        let fxs = effects[rootProperty];
        if (fxs) {
            for (let i = 0, l = fxs.length, fx; i < l && (fx = fxs[i]); i++) {
                if ((!fx.info || fx.info.lastRun !== dedupeId) && (!hasPaths || pathMatchesTrigger(prop, fx.trigger))) {
                    if (fx.info) {
                        fx.info.lastRun = dedupeId;
                    }
                    fx.fn(inst, prop, props, oldProps, fx.info, hasPaths, extraArgs);
                    ran = true;
                }
            }
        }
        return ran;
    }
    function pathMatchesTrigger(path, trigger) {
        if (trigger) {
            let triggerPath = trigger.name;
            return triggerPath == path || trigger.structured && Polymer.Path.isAncestor(triggerPath, path) || trigger.wildcard && Polymer.Path.isDescendant(triggerPath, path);
        } else {
            return true;
        }
    }
    function runObserverEffect(inst, property, props, oldProps, info) {
        let fn = inst[info.methodName];
        let changedProp = info.property;
        if (fn) {
            fn.call(inst, inst.__data[changedProp], oldProps[changedProp]);
        } else if (!info.dynamicFn) {
            console.warn("observer method `" + info.methodName + "` not defined");
        }
    }
    function runNotifyEffects(inst, notifyProps, props, oldProps, hasPaths) {
        let fxs = inst[TYPES.NOTIFY];
        let notified;
        let id = dedupeId++;
        for (let prop in notifyProps) {
            if (notifyProps[prop]) {
                if (fxs && runEffectsForProperty(inst, fxs, id, prop, props, oldProps, hasPaths)) {
                    notified = true;
                } else if (hasPaths && notifyPath(inst, prop, props)) {
                    notified = true;
                }
            }
        }
        let host;
        if (notified && (host = inst.__dataHost) && host._invalidateProperties) {
            host._invalidateProperties();
        }
    }
    function notifyPath(inst, path, props) {
        let rootProperty = Polymer.Path.root(path);
        if (rootProperty !== path) {
            let eventName = Polymer.CaseMap.camelToDashCase(rootProperty) + "-changed";
            dispatchNotifyEvent(inst, eventName, props[path], path);
            return true;
        }
        return false;
    }
    function dispatchNotifyEvent(inst, eventName, value, path) {
        let detail = {
            value: value,
            queueProperty: true
        };
        if (path) {
            detail.path = path;
        }
        inst.dispatchEvent(new CustomEvent(eventName, {
            detail: detail
        }));
    }
    function runNotifyEffect(inst, property, props, oldProps, info, hasPaths) {
        let rootProperty = hasPaths ? Polymer.Path.root(property) : property;
        let path = rootProperty != property ? property : null;
        let value = path ? Polymer.Path.get(inst, path) : inst.__data[property];
        if (path && value === undefined) {
            value = props[property];
        }
        dispatchNotifyEvent(inst, info.eventName, value, path);
    }
    function handleNotification(event, inst, fromProp, toPath, negate) {
        let value;
        let detail = event.detail;
        let fromPath = detail && detail.path;
        if (fromPath) {
            toPath = Polymer.Path.translate(fromProp, toPath, fromPath);
            value = detail && detail.value;
        } else {
            value = event.target[fromProp];
        }
        value = negate ? !value : value;
        if (!inst[TYPES.READ_ONLY] || !inst[TYPES.READ_ONLY][toPath]) {
            if (inst._setPendingPropertyOrPath(toPath, value, true, Boolean(fromPath)) && (!detail || !detail.queueProperty)) {
                inst._invalidateProperties();
            }
        }
    }
    function runReflectEffect(inst, property, props, oldProps, info) {
        let value = inst.__data[property];
        if (Polymer.sanitizeDOMValue) {
            value = Polymer.sanitizeDOMValue(value, info.attrName, "attribute", inst);
        }
        inst._propertyToAttribute(property, info.attrName, value);
    }
    function runComputedEffects(inst, changedProps, oldProps, hasPaths) {
        let computeEffects = inst[TYPES.COMPUTE];
        if (computeEffects) {
            let inputProps = changedProps;
            while (runEffects(inst, computeEffects, inputProps, oldProps, hasPaths)) {
                Object.assign(oldProps, inst.__dataOld);
                Object.assign(changedProps, inst.__dataPending);
                inputProps = inst.__dataPending;
                inst.__dataPending = null;
            }
        }
    }
    function runComputedEffect(inst, property, props, oldProps, info) {
        let result = runMethodEffect(inst, property, props, oldProps, info);
        let computedProp = info.methodInfo;
        if (inst.__dataHasAccessor && inst.__dataHasAccessor[computedProp]) {
            inst._setPendingProperty(computedProp, result, true);
        } else {
            inst[computedProp] = result;
        }
    }
    function computeLinkedPaths(inst, path, value) {
        let links = inst.__dataLinkedPaths;
        if (links) {
            let link;
            for (let a in links) {
                let b = links[a];
                if (Polymer.Path.isDescendant(a, path)) {
                    link = Polymer.Path.translate(a, b, path);
                    inst._setPendingPropertyOrPath(link, value, true, true);
                } else if (Polymer.Path.isDescendant(b, path)) {
                    link = Polymer.Path.translate(b, a, path);
                    inst._setPendingPropertyOrPath(link, value, true, true);
                }
            }
        }
    }
    function addBinding(constructor, templateInfo, nodeInfo, kind, target, parts, literal) {
        nodeInfo.bindings = nodeInfo.bindings || [];
        let binding = {
            kind: kind,
            target: target,
            parts: parts,
            literal: literal,
            isCompound: parts.length !== 1
        };
        nodeInfo.bindings.push(binding);
        if (shouldAddListener(binding)) {
            var _binding$parts$ = binding.parts[0];
            let event = _binding$parts$.event,
                negate = _binding$parts$.negate;

            binding.listenerEvent = event || CaseMap.camelToDashCase(target) + "-changed";
            binding.listenerNegate = negate;
        }
        let index = templateInfo.nodeInfoList.length;
        for (let i = 0; i < binding.parts.length; i++) {
            let part = binding.parts[i];
            part.compoundIndex = i;
            addEffectForBindingPart(constructor, templateInfo, binding, part, index);
        }
    }
    function addEffectForBindingPart(constructor, templateInfo, binding, part, index) {
        if (!part.literal) {
            if (binding.kind === "attribute" && binding.target[0] === "-") {
                console.warn("Cannot set attribute " + binding.target + ' because "-" is not a valid attribute starting character');
            } else {
                let dependencies = part.dependencies;
                let info = {
                    index: index,
                    binding: binding,
                    part: part,
                    evaluator: constructor
                };
                for (let j = 0; j < dependencies.length; j++) {
                    let trigger = dependencies[j];
                    if (typeof trigger == "string") {
                        trigger = parseArg(trigger);
                        trigger.wildcard = true;
                    }
                    constructor._addTemplatePropertyEffect(templateInfo, trigger.rootProperty, {
                        fn: runBindingEffect,
                        info: info,
                        trigger: trigger
                    });
                }
            }
        }
    }
    function runBindingEffect(inst, path, props, oldProps, info, hasPaths, nodeList) {
        let node = nodeList[info.index];
        let binding = info.binding;
        let part = info.part;
        if (hasPaths && part.source && path.length > part.source.length && binding.kind == "property" && !binding.isCompound && node.__dataHasAccessor && node.__dataHasAccessor[binding.target]) {
            let value = props[path];
            path = Polymer.Path.translate(part.source, binding.target, path);
            if (node._setPendingPropertyOrPath(path, value, false, true)) {
                inst._enqueueClient(node);
            }
        } else {
            let value = info.evaluator._evaluateBinding(inst, part, path, props, oldProps, hasPaths);
            applyBindingValue(inst, node, binding, part, value);
        }
    }
    function applyBindingValue(inst, node, binding, part, value) {
        value = computeBindingValue(node, value, binding, part);
        if (Polymer.sanitizeDOMValue) {
            value = Polymer.sanitizeDOMValue(value, binding.target, binding.kind, node);
        }
        if (binding.kind == "attribute") {
            inst._valueToNodeAttribute(node, value, binding.target);
        } else {
            let prop = binding.target;
            if (node.__dataHasAccessor && node.__dataHasAccessor[prop]) {
                if (!node[TYPES.READ_ONLY] || !node[TYPES.READ_ONLY][prop]) {
                    if (node._setPendingProperty(prop, value)) {
                        inst._enqueueClient(node);
                    }
                }
            } else {
                inst._setUnmanagedPropertyToNode(node, prop, value);
            }
        }
    }
    function computeBindingValue(node, value, binding, part) {
        if (binding.isCompound) {
            let storage = node.__dataCompoundStorage[binding.target];
            storage[part.compoundIndex] = value;
            value = storage.join("");
        }
        if (binding.kind !== "attribute") {
            if (binding.target === "textContent" || node.localName == "input" && binding.target == "value") {
                value = value == undefined ? "" : value;
            }
        }
        return value;
    }
    function shouldAddListener(binding) {
        return Boolean(binding.target) && binding.kind != "attribute" && binding.kind != "text" && !binding.isCompound && binding.parts[0].mode === "{";
    }
    function setupBindings(inst, templateInfo) {
        let nodeList = templateInfo.nodeList,
            nodeInfoList = templateInfo.nodeInfoList;

        if (nodeInfoList.length) {
            for (let i = 0; i < nodeInfoList.length; i++) {
                let info = nodeInfoList[i];
                let node = nodeList[i];
                let bindings = info.bindings;
                if (bindings) {
                    for (let i = 0; i < bindings.length; i++) {
                        let binding = bindings[i];
                        setupCompoundStorage(node, binding);
                        addNotifyListener(node, inst, binding);
                    }
                }
                node.__dataHost = inst;
            }
        }
    }
    function setupCompoundStorage(node, binding) {
        if (binding.isCompound) {
            let storage = node.__dataCompoundStorage || (node.__dataCompoundStorage = {});
            let parts = binding.parts;
            let literals = new Array(parts.length);
            for (let j = 0; j < parts.length; j++) {
                literals[j] = parts[j].literal;
            }
            let target = binding.target;
            storage[target] = literals;
            if (binding.literal && binding.kind == "property") {
                node[target] = binding.literal;
            }
        }
    }
    function addNotifyListener(node, inst, binding) {
        if (binding.listenerEvent) {
            let part = binding.parts[0];
            node.addEventListener(binding.listenerEvent, function (e) {
                handleNotification(e, inst, binding.target, part.source, part.negate);
            });
        }
    }
    function createMethodEffect(model, sig, type, effectFn, methodInfo, dynamicFn) {
        dynamicFn = sig.static || dynamicFn && (typeof dynamicFn !== "object" || dynamicFn[sig.methodName]);
        let info = {
            methodName: sig.methodName,
            args: sig.args,
            methodInfo: methodInfo,
            dynamicFn: dynamicFn
        };
        for (let i = 0, arg; i < sig.args.length && (arg = sig.args[i]); i++) {
            if (!arg.literal) {
                model._addPropertyEffect(arg.rootProperty, type, {
                    fn: effectFn,
                    info: info,
                    trigger: arg
                });
            }
        }
        if (dynamicFn) {
            model._addPropertyEffect(sig.methodName, type, {
                fn: effectFn,
                info: info
            });
        }
    }
    function runMethodEffect(inst, property, props, oldProps, info) {
        let context = inst._methodHost || inst;
        let fn = context[info.methodName];
        if (fn) {
            let args = marshalArgs(inst.__data, info.args, property, props);
            return fn.apply(context, args);
        } else if (!info.dynamicFn) {
            console.warn("method `" + info.methodName + "` not defined");
        }
    }
    const emptyArray = [];
    const IDENT = "(?:" + "[a-zA-Z_$][\\w.:$\\-*]*" + ")";
    const NUMBER = "(?:" + "[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?" + ")";
    const SQUOTE_STRING = "(?:" + "'(?:[^'\\\\]|\\\\.)*'" + ")";
    const DQUOTE_STRING = "(?:" + '"(?:[^"\\\\]|\\\\.)*"' + ")";
    const STRING = "(?:" + SQUOTE_STRING + "|" + DQUOTE_STRING + ")";
    const ARGUMENT = "(?:(" + IDENT + "|" + NUMBER + "|" + STRING + ")\\s*" + ")";
    const ARGUMENTS = "(?:" + ARGUMENT + "(?:,\\s*" + ARGUMENT + ")*" + ")";
    const ARGUMENT_LIST = "(?:" + "\\(\\s*" + "(?:" + ARGUMENTS + "?" + ")" + "\\)\\s*" + ")";
    const BINDING = "(" + IDENT + "\\s*" + ARGUMENT_LIST + "?" + ")";
    const OPEN_BRACKET = "(\\[\\[|{{)" + "\\s*";
    const CLOSE_BRACKET = "(?:]]|}})";
    const NEGATE = "(?:(!)\\s*)?";
    const EXPRESSION = OPEN_BRACKET + NEGATE + BINDING + CLOSE_BRACKET;
    const bindingRegex = new RegExp(EXPRESSION, "g");
    function literalFromParts(parts) {
        let s = "";
        for (let i = 0; i < parts.length; i++) {
            let literal = parts[i].literal;
            s += literal || "";
        }
        return s;
    }
    function parseMethod(expression) {
        let m = expression.match(/([^\s]+?)\(([\s\S]*)\)/);
        if (m) {
            let methodName = m[1];
            let sig = {
                methodName: methodName,
                static: true,
                args: emptyArray
            };
            if (m[2].trim()) {
                let args = m[2].replace(/\\,/g, "&comma;").split(",");
                return parseArgs(args, sig);
            } else {
                return sig;
            }
        }
        return null;
    }
    function parseArgs(argList, sig) {
        sig.args = argList.map(function (rawArg) {
            let arg = parseArg(rawArg);
            if (!arg.literal) {
                sig.static = false;
            }
            return arg;
        }, this);
        return sig;
    }
    function parseArg(rawArg) {
        let arg = rawArg.trim().replace(/&comma;/g, ",").replace(/\\(.)/g, "$1");
        let a = {
            name: arg,
            value: "",
            literal: false
        };
        let fc = arg[0];
        if (fc === "-") {
            fc = arg[1];
        }
        if (fc >= "0" && fc <= "9") {
            fc = "#";
        }
        switch (fc) {
            case "'":
            case '"':
                a.value = arg.slice(1, -1);
                a.literal = true;
                break;

            case "#":
                a.value = Number(arg);
                a.literal = true;
                break;
        }
        if (!a.literal) {
            a.rootProperty = Polymer.Path.root(arg);
            a.structured = Polymer.Path.isPath(arg);
            if (a.structured) {
                a.wildcard = arg.slice(-2) == ".*";
                if (a.wildcard) {
                    a.name = arg.slice(0, -2);
                }
            }
        }
        return a;
    }
    function marshalArgs(data, args, path, props) {
        let values = [];
        for (let i = 0, l = args.length; i < l; i++) {
            let arg = args[i];
            let name = arg.name;
            let v;
            if (arg.literal) {
                v = arg.value;
            } else {
                if (arg.structured) {
                    v = Polymer.Path.get(data, name);
                    if (v === undefined) {
                        v = props[name];
                    }
                } else {
                    v = data[name];
                }
            }
            if (arg.wildcard) {
                let baseChanged = name.indexOf(path + ".") === 0;
                let matches = path.indexOf(name) === 0 && !baseChanged;
                values[i] = {
                    path: matches ? path : name,
                    value: matches ? props[path] : v,
                    base: v
                };
            } else {
                values[i] = v;
            }
        }
        return values;
    }
    function notifySplices(inst, array, path, splices) {
        let splicesPath = path + ".splices";
        inst.notifyPath(splicesPath, {
            indexSplices: splices
        });
        inst.notifyPath(path + ".length", array.length);
        inst.__data[splicesPath] = {
            indexSplices: null
        };
    }
    function notifySplice(inst, array, path, index, addedCount, removed) {
        notifySplices(inst, array, path, [{
            index: index,
            addedCount: addedCount,
            removed: removed,
            object: array,
            type: "splice"
        }]);
    }
    function upper(name) {
        return name[0].toUpperCase() + name.substring(1);
    }
    Polymer.PropertyEffects = Polymer.dedupingMixin(superClass => {
        const propertyEffectsBase = Polymer.TemplateStamp(Polymer.PropertyAccessors(superClass));
        class PropertyEffects extends propertyEffectsBase {
            constructor() {
                super();
                this.__dataClientsReady;
                this.__dataPendingClients;
                this.__dataToNotify;
                this.__dataLinkedPaths;
                this.__dataHasPaths;
                this.__dataCompoundStorage;
                this.__dataHost;
                this.__dataTemp;
                this.__dataClientsInitialized;
                this.__data;
                this.__dataPending;
                this.__dataOld;
                this.__computeEffects;
                this.__reflectEffects;
                this.__notifyEffects;
                this.__propagateEffects;
                this.__observeEffects;
                this.__readOnly;
                this.__dataCounter;
                this.__templateInfo;
            }
            get PROPERTY_EFFECT_TYPES() {
                return TYPES;
            }
            _initializeProperties() {
                super._initializeProperties();
                hostStack.registerHost(this);
                this.__dataClientsReady = false;
                this.__dataPendingClients = null;
                this.__dataToNotify = null;
                this.__dataLinkedPaths = null;
                this.__dataHasPaths = false;
                this.__dataCompoundStorage = this.__dataCompoundStorage || null;
                this.__dataHost = this.__dataHost || null;
                this.__dataTemp = {};
                this.__dataClientsInitialized = false;
            }
            _initializeProtoProperties(props) {
                this.__data = Object.create(props);
                this.__dataPending = Object.create(props);
                this.__dataOld = {};
            }
            _initializeInstanceProperties(props) {
                let readOnly = this[TYPES.READ_ONLY];
                for (let prop in props) {
                    if (!readOnly || !readOnly[prop]) {
                        this.__dataPending = this.__dataPending || {};
                        this.__dataOld = this.__dataOld || {};
                        this.__data[prop] = this.__dataPending[prop] = props[prop];
                    }
                }
            }
            _addPropertyEffect(property, type, effect) {
                this._createPropertyAccessor(property, type == TYPES.READ_ONLY);
                let effects = ensureOwnEffectMap(this, type)[property];
                if (!effects) {
                    effects = this[type][property] = [];
                }
                effects.push(effect);
            }
            _removePropertyEffect(property, type, effect) {
                let effects = ensureOwnEffectMap(this, type)[property];
                let idx = effects.indexOf(effect);
                if (idx >= 0) {
                    effects.splice(idx, 1);
                }
            }
            _hasPropertyEffect(property, type) {
                let effects = this[type];
                return Boolean(effects && effects[property]);
            }
            _hasReadOnlyEffect(property) {
                return this._hasPropertyEffect(property, TYPES.READ_ONLY);
            }
            _hasNotifyEffect(property) {
                return this._hasPropertyEffect(property, TYPES.NOTIFY);
            }
            _hasReflectEffect(property) {
                return this._hasPropertyEffect(property, TYPES.REFLECT);
            }
            _hasComputedEffect(property) {
                return this._hasPropertyEffect(property, TYPES.COMPUTE);
            }
            _setPendingPropertyOrPath(path, value, shouldNotify, isPathNotification) {
                if (isPathNotification || Polymer.Path.root(Array.isArray(path) ? path[0] : path) !== path) {
                    if (!isPathNotification) {
                        let old = Polymer.Path.get(this, path);
                        path = Polymer.Path.set(this, path, value);
                        if (!path || !super._shouldPropertyChange(path, value, old)) {
                            return false;
                        }
                    }
                    this.__dataHasPaths = true;
                    if (this._setPendingProperty(path, value, shouldNotify)) {
                        computeLinkedPaths(this, path, value);
                        return true;
                    }
                } else {
                    if (this.__dataHasAccessor && this.__dataHasAccessor[path]) {
                        return this._setPendingProperty(path, value, shouldNotify);
                    } else {
                        this[path] = value;
                    }
                }
                return false;
            }
            _setUnmanagedPropertyToNode(node, prop, value) {
                if (value !== node[prop] || typeof value == "object") {
                    node[prop] = value;
                }
            }
            _setPendingProperty(property, value, shouldNotify) {
                let isPath = this.__dataHasPaths && Polymer.Path.isPath(property);
                let prevProps = isPath ? this.__dataTemp : this.__data;
                if (this._shouldPropertyChange(property, value, prevProps[property])) {
                    if (!this.__dataPending) {
                        this.__dataPending = {};
                        this.__dataOld = {};
                    }
                    if (!(property in this.__dataOld)) {
                        this.__dataOld[property] = this.__data[property];
                    }
                    if (isPath) {
                        this.__dataTemp[property] = value;
                    } else {
                        this.__data[property] = value;
                    }
                    this.__dataPending[property] = value;
                    if (isPath || this[TYPES.NOTIFY] && this[TYPES.NOTIFY][property]) {
                        this.__dataToNotify = this.__dataToNotify || {};
                        this.__dataToNotify[property] = shouldNotify;
                    }
                    return true;
                }
                return false;
            }
            _setProperty(property, value) {
                if (this._setPendingProperty(property, value, true)) {
                    this._invalidateProperties();
                }
            }
            _invalidateProperties() {
                if (this.__dataReady) {
                    this._flushProperties();
                }
            }
            _enqueueClient(client) {
                this.__dataPendingClients = this.__dataPendingClients || [];
                if (client !== this) {
                    this.__dataPendingClients.push(client);
                }
            }
            _flushClients() {
                if (!this.__dataClientsReady) {
                    this.__dataClientsReady = true;
                    this._readyClients();
                    this.__dataReady = true;
                } else {
                    this.__enableOrFlushClients();
                }
            }
            __enableOrFlushClients() {
                let clients = this.__dataPendingClients;
                if (clients) {
                    this.__dataPendingClients = null;
                    for (let i = 0; i < clients.length; i++) {
                        let client = clients[i];
                        if (!client.__dataEnabled) {
                            client._enableProperties();
                        } else if (client.__dataPending) {
                            client._flushProperties();
                        }
                    }
                }
            }
            _readyClients() {
                this.__enableOrFlushClients();
            }
            setProperties(props, setReadOnly) {
                for (let path in props) {
                    if (setReadOnly || !this[TYPES.READ_ONLY] || !this[TYPES.READ_ONLY][path]) {
                        this._setPendingPropertyOrPath(path, props[path], true);
                    }
                }
                this._invalidateProperties();
            }
            ready() {
                this._flushProperties();
                if (!this.__dataClientsReady) {
                    this._flushClients();
                }
                if (this.__dataPending) {
                    this._flushProperties();
                }
            }
            _propertiesChanged(currentProps, changedProps, oldProps) {
                let hasPaths = this.__dataHasPaths;
                this.__dataHasPaths = false;
                runComputedEffects(this, changedProps, oldProps, hasPaths);
                let notifyProps = this.__dataToNotify;
                this.__dataToNotify = null;
                this._propagatePropertyChanges(changedProps, oldProps, hasPaths);
                this._flushClients();
                runEffects(this, this[TYPES.REFLECT], changedProps, oldProps, hasPaths);
                runEffects(this, this[TYPES.OBSERVE], changedProps, oldProps, hasPaths);
                if (notifyProps) {
                    runNotifyEffects(this, notifyProps, changedProps, oldProps, hasPaths);
                }
                if (this.__dataCounter == 1) {
                    this.__dataTemp = {};
                }
            }
            _propagatePropertyChanges(changedProps, oldProps, hasPaths) {
                if (this[TYPES.PROPAGATE]) {
                    runEffects(this, this[TYPES.PROPAGATE], changedProps, oldProps, hasPaths);
                }
                let templateInfo = this.__templateInfo;
                while (templateInfo) {
                    runEffects(this, templateInfo.propertyEffects, changedProps, oldProps, hasPaths, templateInfo.nodeList);
                    templateInfo = templateInfo.nextTemplateInfo;
                }
            }
            linkPaths(to, from) {
                to = Polymer.Path.normalize(to);
                from = Polymer.Path.normalize(from);
                this.__dataLinkedPaths = this.__dataLinkedPaths || {};
                this.__dataLinkedPaths[to] = from;
            }
            unlinkPaths(path) {
                path = Polymer.Path.normalize(path);
                if (this.__dataLinkedPaths) {
                    delete this.__dataLinkedPaths[path];
                }
            }
            notifySplices(path, splices) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);
                notifySplices(this, array, info.path, splices);
            }
            get(path, root) {
                return Polymer.Path.get(root || this, path);
            }
            set(path, value, root) {
                if (root) {
                    Polymer.Path.set(root, path, value);
                } else {
                    if (!this[TYPES.READ_ONLY] || !this[TYPES.READ_ONLY][path]) {
                        if (this._setPendingPropertyOrPath(path, value, true)) {
                            this._invalidateProperties();
                        }
                    }
                }
            }
            push(path) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);
                let len = array.length;

                for (var _len = arguments.length, items = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                    items[_key - 1] = arguments[_key];
                }

                let ret = array.push.apply(array, items);
                if (items.length) {
                    notifySplice(this, array, info.path, len, items.length, []);
                }
                return ret;
            }
            pop(path) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);
                let hadLength = Boolean(array.length);
                let ret = array.pop();
                if (hadLength) {
                    notifySplice(this, array, info.path, array.length, 0, [ret]);
                }
                return ret;
            }
            splice(path, start, deleteCount) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);
                if (start < 0) {
                    start = array.length - Math.floor(-start);
                } else {
                    start = Math.floor(start);
                }
                if (!start) {
                    start = 0;
                }

                for (var _len2 = arguments.length, items = Array(_len2 > 3 ? _len2 - 3 : 0), _key2 = 3; _key2 < _len2; _key2++) {
                    items[_key2 - 3] = arguments[_key2];
                }

                let ret = array.splice.apply(array, [start, deleteCount].concat(items));
                if (items.length || ret.length) {
                    notifySplice(this, array, info.path, start, items.length, ret);
                }
                return ret;
            }
            shift(path) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);
                let hadLength = Boolean(array.length);
                let ret = array.shift();
                if (hadLength) {
                    notifySplice(this, array, info.path, 0, 0, [ret]);
                }
                return ret;
            }
            unshift(path) {
                let info = {
                    path: ""
                };
                let array = Polymer.Path.get(this, path, info);

                for (var _len3 = arguments.length, items = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                    items[_key3 - 1] = arguments[_key3];
                }

                let ret = array.unshift.apply(array, items);
                if (items.length) {
                    notifySplice(this, array, info.path, 0, items.length, []);
                }
                return ret;
            }
            notifyPath(path, value) {
                let propPath;
                if (arguments.length == 1) {
                    let info = {
                        path: ""
                    };
                    value = Polymer.Path.get(this, path, info);
                    propPath = info.path;
                } else if (Array.isArray(path)) {
                    propPath = Polymer.Path.normalize(path);
                } else {
                    propPath = path;
                }
                if (this._setPendingPropertyOrPath(propPath, value, true, true)) {
                    this._invalidateProperties();
                }
            }
            _createReadOnlyProperty(property, protectedSetter) {
                this._addPropertyEffect(property, TYPES.READ_ONLY);
                if (protectedSetter) {
                    this["_set" + upper(property)] = function (value) {
                        this._setProperty(property, value);
                    };
                }
            }
            _createPropertyObserver(property, methodName, dynamicFn) {
                let info = {
                    property: property,
                    methodName: methodName,
                    dynamicFn: Boolean(dynamicFn)
                };
                this._addPropertyEffect(property, TYPES.OBSERVE, {
                    fn: runObserverEffect,
                    info: info,
                    trigger: {
                        name: property
                    }
                });
                if (dynamicFn) {
                    this._addPropertyEffect(methodName, TYPES.OBSERVE, {
                        fn: runObserverEffect,
                        info: info,
                        trigger: {
                            name: methodName
                        }
                    });
                }
            }
            _createMethodObserver(expression, dynamicFn) {
                let sig = parseMethod(expression);
                if (!sig) {
                    throw new Error("Malformed observer expression '" + expression + "'");
                }
                createMethodEffect(this, sig, TYPES.OBSERVE, runMethodEffect, null, dynamicFn);
            }
            _createNotifyingProperty(property) {
                this._addPropertyEffect(property, TYPES.NOTIFY, {
                    fn: runNotifyEffect,
                    info: {
                        eventName: CaseMap.camelToDashCase(property) + "-changed",
                        property: property
                    }
                });
            }
            _createReflectedProperty(property) {
                let attr = CaseMap.camelToDashCase(property);
                if (attr[0] === "-") {
                    console.warn("Property " + property + " cannot be reflected to attribute " + attr + ' because "-" is not a valid starting attribute name. Use a lowercase first letter for the property thisead.');
                } else {
                    this._addPropertyEffect(property, TYPES.REFLECT, {
                        fn: runReflectEffect,
                        info: {
                            attrName: attr
                        }
                    });
                }
            }
            _createComputedProperty(property, expression, dynamicFn) {
                let sig = parseMethod(expression);
                if (!sig) {
                    throw new Error("Malformed computed expression '" + expression + "'");
                }
                createMethodEffect(this, sig, TYPES.COMPUTE, runComputedEffect, property, dynamicFn);
            }
            static addPropertyEffect(property, type, effect) {
                this.prototype._addPropertyEffect(property, type, effect);
            }
            static createPropertyObserver(property, methodName, dynamicFn) {
                this.prototype._createPropertyObserver(property, methodName, dynamicFn);
            }
            static createMethodObserver(expression, dynamicFn) {
                this.prototype._createMethodObserver(expression, dynamicFn);
            }
            static createNotifyingProperty(property) {
                this.prototype._createNotifyingProperty(property);
            }
            static createReadOnlyProperty(property, protectedSetter) {
                this.prototype._createReadOnlyProperty(property, protectedSetter);
            }
            static createReflectedProperty(property) {
                this.prototype._createReflectedProperty(property);
            }
            static createComputedProperty(property, expression, dynamicFn) {
                this.prototype._createComputedProperty(property, expression, dynamicFn);
            }
            static bindTemplate(template) {
                return this.prototype._bindTemplate(template);
            }
            _bindTemplate(template, instanceBinding) {
                let templateInfo = this.constructor._parseTemplate(template);
                let wasPreBound = this.__templateInfo == templateInfo;
                if (!wasPreBound) {
                    for (let prop in templateInfo.propertyEffects) {
                        this._createPropertyAccessor(prop);
                    }
                }
                if (instanceBinding) {
                    templateInfo = Object.create(templateInfo);
                    templateInfo.wasPreBound = wasPreBound;
                    if (!wasPreBound && this.__templateInfo) {
                        let last = this.__templateInfoLast || this.__templateInfo;
                        this.__templateInfoLast = last.nextTemplateInfo = templateInfo;
                        templateInfo.previousTemplateInfo = last;
                        return templateInfo;
                    }
                }
                return this.__templateInfo = templateInfo;
            }
            static _addTemplatePropertyEffect(templateInfo, prop, effect) {
                let hostProps = templateInfo.hostProps = templateInfo.hostProps || {};
                hostProps[prop] = true;
                let effects = templateInfo.propertyEffects = templateInfo.propertyEffects || {};
                let propEffects = effects[prop] = effects[prop] || [];
                propEffects.push(effect);
            }
            _stampTemplate(template) {
                hostStack.beginHosting(this);
                let dom = super._stampTemplate(template);
                hostStack.endHosting(this);
                let templateInfo = this._bindTemplate(template, true);
                templateInfo.nodeList = dom.nodeList;
                if (!templateInfo.wasPreBound) {
                    let nodes = templateInfo.childNodes = [];
                    for (let n = dom.firstChild; n; n = n.nextSibling) {
                        nodes.push(n);
                    }
                }
                dom.templateInfo = templateInfo;
                setupBindings(this, templateInfo);
                if (this.__dataReady) {
                    runEffects(this, templateInfo.propertyEffects, this.__data, null, false, templateInfo.nodeList);
                }
                return dom;
            }
            _removeBoundDom(dom) {
                let templateInfo = dom.templateInfo;
                if (templateInfo.previousTemplateInfo) {
                    templateInfo.previousTemplateInfo.nextTemplateInfo = templateInfo.nextTemplateInfo;
                }
                if (templateInfo.nextTemplateInfo) {
                    templateInfo.nextTemplateInfo.previousTemplateInfo = templateInfo.previousTemplateInfo;
                }
                if (this.__templateInfoLast == templateInfo) {
                    this.__templateInfoLast = templateInfo.previousTemplateInfo;
                }
                templateInfo.previousTemplateInfo = templateInfo.nextTemplateInfo = null;
                let nodes = templateInfo.childNodes;
                for (let i = 0; i < nodes.length; i++) {
                    let node = nodes[i];
                    node.parentNode.removeChild(node);
                }
            }
            static _parseTemplateNode(node, templateInfo, nodeInfo) {
                let noted = super._parseTemplateNode(node, templateInfo, nodeInfo);
                if (node.nodeType === Node.TEXT_NODE) {
                    let parts = this._parseBindings(node.textContent, templateInfo);
                    if (parts) {
                        node.textContent = literalFromParts(parts) || " ";
                        addBinding(this, templateInfo, nodeInfo, "text", "textContent", parts);
                        noted = true;
                    }
                }
                return noted;
            }
            static _parseTemplateNodeAttribute(node, templateInfo, nodeInfo, name, value) {
                let parts = this._parseBindings(value, templateInfo);
                if (parts) {
                    let origName = name;
                    let kind = "property";
                    if (name[name.length - 1] == "$") {
                        name = name.slice(0, -1);
                        kind = "attribute";
                    }
                    let literal = literalFromParts(parts);
                    if (literal && kind == "attribute") {
                        node.setAttribute(name, literal);
                    }
                    if (node.localName === "input" && origName === "value") {
                        node.setAttribute(origName, "");
                    }
                    node.removeAttribute(origName);
                    if (kind === "property") {
                        name = Polymer.CaseMap.dashToCamelCase(name);
                    }
                    addBinding(this, templateInfo, nodeInfo, kind, name, parts, literal);
                    return true;
                } else {
                    return super._parseTemplateNodeAttribute(node, templateInfo, nodeInfo, name, value);
                }
            }
            static _parseTemplateNestedTemplate(node, templateInfo, nodeInfo) {
                let noted = super._parseTemplateNestedTemplate(node, templateInfo, nodeInfo);
                let hostProps = nodeInfo.templateInfo.hostProps;
                let mode = "{";
                for (let source in hostProps) {
                    let parts = [{
                        mode: mode,
                        source: source,
                        dependencies: [source]
                    }];
                    addBinding(this, templateInfo, nodeInfo, "property", "_host_" + source, parts);
                }
                return noted;
            }
            static _parseBindings(text, templateInfo) {
                let parts = [];
                let lastIndex = 0;
                let m;
                while ((m = bindingRegex.exec(text)) !== null) {
                    if (m.index > lastIndex) {
                        parts.push({
                            literal: text.slice(lastIndex, m.index)
                        });
                    }
                    let mode = m[1][0];
                    let negate = Boolean(m[2]);
                    let source = m[3].trim();
                    let customEvent = false,
                        notifyEvent = "",
                        colon = -1;
                    if (mode == "{" && (colon = source.indexOf("::")) > 0) {
                        notifyEvent = source.substring(colon + 2);
                        source = source.substring(0, colon);
                        customEvent = true;
                    }
                    let signature = parseMethod(source);
                    let dependencies = [];
                    if (signature) {
                        let args = signature.args,
                            methodName = signature.methodName;

                        for (let i = 0; i < args.length; i++) {
                            let arg = args[i];
                            if (!arg.literal) {
                                dependencies.push(arg);
                            }
                        }
                        let dynamicFns = templateInfo.dynamicFns;
                        if (dynamicFns && dynamicFns[methodName] || signature.static) {
                            dependencies.push(methodName);
                            signature.dynamicFn = true;
                        }
                    } else {
                        dependencies.push(source);
                    }
                    parts.push({
                        source: source,
                        mode: mode,
                        negate: negate,
                        customEvent: customEvent,
                        signature: signature,
                        dependencies: dependencies,
                        event: notifyEvent
                    });
                    lastIndex = bindingRegex.lastIndex;
                }
                if (lastIndex && lastIndex < text.length) {
                    let literal = text.substring(lastIndex);
                    if (literal) {
                        parts.push({
                            literal: literal
                        });
                    }
                }
                if (parts.length) {
                    return parts;
                } else {
                    return null;
                }
            }
            static _evaluateBinding(inst, part, path, props, oldProps, hasPaths) {
                let value;
                if (part.signature) {
                    value = runMethodEffect(inst, path, props, oldProps, part.signature);
                } else if (path != part.source) {
                    value = Polymer.Path.get(inst, part.source);
                } else {
                    if (hasPaths && Polymer.Path.isPath(path)) {
                        value = Polymer.Path.get(inst, path);
                    } else {
                        value = inst.__data[path];
                    }
                }
                if (part.negate) {
                    value = !value;
                }
                return value;
            }
        }
        PropertyEffectsType = PropertyEffects;
        return PropertyEffects;
    });
    let hostStack = {
        stack: [],
        registerHost(inst) {
            if (this.stack.length) {
                let host = this.stack[this.stack.length - 1];
                host._enqueueClient(inst);
            }
        },
        beginHosting(inst) {
            this.stack.push(inst);
        },
        endHosting(inst) {
            let stackLen = this.stack.length;
            if (stackLen && this.stack[stackLen - 1] == inst) {
                this.stack.pop();
            }
        }
    };
})();

(function () {
    "use strict";

    Polymer.ElementMixin = Polymer.dedupingMixin(base => {
        const polymerElementBase = Polymer.PropertyEffects(base);
        let caseMap = Polymer.CaseMap;
        function ownPropertiesForClass(klass) {
            if (!klass.hasOwnProperty(JSCompiler_renameProperty("__ownProperties", klass))) {
                klass.__ownProperties = klass.hasOwnProperty(JSCompiler_renameProperty("properties", klass)) ? klass.properties : {};
            }
            return klass.__ownProperties;
        }
        function ownObserversForClass(klass) {
            if (!klass.hasOwnProperty(JSCompiler_renameProperty("__ownObservers", klass))) {
                klass.__ownObservers = klass.hasOwnProperty(JSCompiler_renameProperty("observers", klass)) ? klass.observers : [];
            }
            return klass.__ownObservers;
        }
        function flattenProperties(flattenedProps, props) {
            for (let p in props) {
                let o = props[p];
                if (typeof o == "function") {
                    o = {
                        type: o
                    };
                }
                flattenedProps[p] = o;
            }
            return flattenedProps;
        }
        function propertiesForClass(klass) {
            if (!klass.hasOwnProperty(JSCompiler_renameProperty("__classProperties", klass))) {
                klass.__classProperties = flattenProperties({}, ownPropertiesForClass(klass));
                let superCtor = Object.getPrototypeOf(klass.prototype).constructor;
                if (superCtor.prototype instanceof PolymerElement) {
                    klass.__classProperties = Object.assign(Object.create(propertiesForClass(superCtor)), klass.__classProperties);
                }
            }
            return klass.__classProperties;
        }
        function propertyDefaultsForClass(klass) {
            if (!klass.hasOwnProperty(JSCompiler_renameProperty("__classPropertyDefaults", klass))) {
                klass.__classPropertyDefaults = null;
                let props = propertiesForClass(klass);
                for (let p in props) {
                    let info = props[p];
                    if ("value" in info) {
                        klass.__classPropertyDefaults = klass.__classPropertyDefaults || {};
                        klass.__classPropertyDefaults[p] = info;
                    }
                }
            }
            return klass.__classPropertyDefaults;
        }
        function hasClassFinalized(klass) {
            return klass.hasOwnProperty(JSCompiler_renameProperty("__finalized", klass));
        }
        function finalizeClassAndSuper(klass) {
            let proto = klass.prototype;
            let superCtor = Object.getPrototypeOf(proto).constructor;
            if (superCtor.prototype instanceof PolymerElement) {
                superCtor.finalize();
            }
            finalizeClass(klass);
        }
        function finalizeClass(klass) {
            klass.__finalized = true;
            let proto = klass.prototype;
            if (klass.hasOwnProperty(JSCompiler_renameProperty("is", klass)) && klass.is) {
                Polymer.telemetry.register(proto);
            }
            let props = ownPropertiesForClass(klass);
            if (props) {
                finalizeProperties(proto, props);
            }
            let observers = ownObserversForClass(klass);
            if (observers) {
                finalizeObservers(proto, observers, props);
            }
            let template = klass.template;
            if (template) {
                if (typeof template === "string") {
                    let t = document.createElement("template");
                    t.innerHTML = template;
                    template = t;
                } else {
                    template = template.cloneNode(true);
                }
                proto._template = template;
            }
        }
        function finalizeProperties(proto, properties) {
            for (let p in properties) {
                createPropertyFromConfig(proto, p, properties[p], properties);
            }
        }
        function finalizeObservers(proto, observers, dynamicFns) {
            for (let i = 0; i < observers.length; i++) {
                proto._createMethodObserver(observers[i], dynamicFns);
            }
        }
        function createPropertyFromConfig(proto, name, info, allProps) {
            if (info.computed) {
                info.readOnly = true;
            }
            if (info.computed && !proto._hasReadOnlyEffect(name)) {
                proto._createComputedProperty(name, info.computed, allProps);
            }
            if (info.readOnly && !proto._hasReadOnlyEffect(name)) {
                proto._createReadOnlyProperty(name, !info.computed);
            }
            if (info.reflectToAttribute && !proto._hasReflectEffect(name)) {
                proto._createReflectedProperty(name);
            }
            if (info.notify && !proto._hasNotifyEffect(name)) {
                proto._createNotifyingProperty(name);
            }
            if (info.observer) {
                proto._createPropertyObserver(name, info.observer, allProps[info.observer]);
            }
        }
        function finalizeTemplate(proto, template, baseURI, is, ext) {
            let cssText = Polymer.StyleGather.cssFromTemplate(template, baseURI) + Polymer.StyleGather.cssFromModuleImports(is);
            if (cssText) {
                let style = document.createElement("style");
                style.textContent = cssText;
                template.content.insertBefore(style, template.content.firstChild);
            }
            if (window.ShadyCSS) {
                window.ShadyCSS.prepareTemplate(template, is, ext);
            }
            proto._bindTemplate(template);
        }
        class PolymerElement extends polymerElementBase {
            static get observedAttributes() {
                if (!this.hasOwnProperty(JSCompiler_renameProperty("__observedAttributes", this))) {
                    let list = [];
                    let properties = propertiesForClass(this);
                    for (let prop in properties) {
                        list.push(Polymer.CaseMap.camelToDashCase(prop));
                    }
                    this.__observedAttributes = list;
                }
                return this.__observedAttributes;
            }
            static finalize() {
                if (!hasClassFinalized(this)) {
                    finalizeClassAndSuper(this);
                }
            }
            static get template() {
                if (!this.hasOwnProperty(JSCompiler_renameProperty("_template", this))) {
                    this._template = Polymer.DomModule && Polymer.DomModule.import(this.is, "template") || Object.getPrototypeOf(this.prototype).constructor.template;
                }
                return this._template;
            }
            static get importPath() {
                if (!this.hasOwnProperty(JSCompiler_renameProperty("_importPath", this))) {
                    const module = Polymer.DomModule && Polymer.DomModule.import(this.is);
                    this._importPath = module ? module.assetpath : "" || Object.getPrototypeOf(this.prototype).constructor.importPath;
                }
                return this._importPath;
            }
            _initializeProperties() {
                Polymer.telemetry.instanceCount++;
                this.constructor.finalize();
                const importPath = this.constructor.importPath;
                if (this._template && !this._template.__polymerFinalized) {
                    this._template.__polymerFinalized = true;
                    const baseURI = importPath ? Polymer.ResolveUrl.resolveUrl(importPath) : "";
                    finalizeTemplate(this.__proto__, this._template, baseURI, this.localName);
                }
                super._initializeProperties();
                this.rootPath = Polymer.rootPath;
                this.importPath = importPath;
                let p$ = propertyDefaultsForClass(this.constructor);
                if (!p$) {
                    return;
                }
                for (let p in p$) {
                    let info = p$[p];
                    if (!this.hasOwnProperty(p)) {
                        let value = typeof info.value == "function" ? info.value.call(this) : info.value;
                        if (this._hasAccessor(p)) {
                            this._setPendingProperty(p, value, true);
                        } else {
                            this[p] = value;
                        }
                    }
                }
            }
            connectedCallback() {
                if (window.ShadyCSS && this._template) {
                    window.ShadyCSS.styleElement(this);
                }
                this._enableProperties();
            }
            disconnectedCallback() {}
            ready() {
                if (this._template) {
                    this.root = this._stampTemplate(this._template);
                    this.$ = this.root.$;
                }
                super.ready();
            }
            _readyClients() {
                if (this._template) {
                    this.root = this._attachDom(this.root);
                }
                super._readyClients();
            }
            _attachDom(dom) {
                if (this.attachShadow) {
                    if (dom) {
                        if (!this.shadowRoot) {
                            this.attachShadow({
                                mode: "open"
                            });
                        }
                        this.shadowRoot.appendChild(dom);
                        return this.shadowRoot;
                    }
                    return null;
                } else {
                    throw new Error("ShadowDOM not available. " + "Polymer.Element can create dom as children instead of in " + "ShadowDOM by setting `this.root = this;` before `ready`.");
                }
            }
            attributeChangedCallback(name, old, value) {
                if (old !== value) {
                    let property = caseMap.dashToCamelCase(name);
                    let type = propertiesForClass(this.constructor)[property].type;
                    if (!this._hasReadOnlyEffect(property)) {
                        this._attributeToProperty(name, value, type);
                    }
                }
            }
            updateStyles(properties) {
                if (window.ShadyCSS) {
                    window.ShadyCSS.styleSubtree(this, properties);
                }
            }
            resolveUrl(url, base) {
                if (!base && this.importPath) {
                    base = Polymer.ResolveUrl.resolveUrl(this.importPath);
                }
                return Polymer.ResolveUrl.resolveUrl(url, base);
            }
            static _parseTemplateContent(template, templateInfo, nodeInfo) {
                templateInfo.dynamicFns = templateInfo.dynamicFns || propertiesForClass(this);
                return super._parseTemplateContent(template, templateInfo, nodeInfo);
            }
        }
        return PolymerElement;
    });
    Polymer.telemetry = {
        instanceCount: 0,
        registrations: [],
        _regLog: function (prototype) {
            console.log("[" + prototype.is + "]: registered");
        },
        register: function (prototype) {
            this.registrations.push(prototype);
            Polymer.log && this._regLog(prototype);
        },
        dumpRegistrations: function () {
            this.registrations.forEach(this._regLog);
        }
    };
    Polymer.updateStyles = function (props) {
        if (window.ShadyCSS) {
            window.ShadyCSS.styleDocument(props);
        }
    };
})();

(function () {
    "use strict";

    const Element = Polymer.ElementMixin(HTMLElement);
    Polymer.Element = Element;
})();
//# sourceMappingURL=polymer.js.map
