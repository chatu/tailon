Vue.component('multiselect', window.VueMultiselect.default);
Vue.component('vue-loading', window.VueLoading);

var apiURL = endsWith(window.location.href, '/') ?
    window.location.href + "ws" :
    window.location.href.replace(/[^\/]+$/, 'ws');

var app = new Vue({
    el: '#app',
    delimiters: ['<%', '%>'],
    data: {
        'relativeRoot': relativeRoot,
        'commandScripts': commandScripts,

        'fileList': [],
        'groups': [],
        'grouped': false,
        'allowCommandNames': allowCommandNames,
        'allowDownload': allowDownload,

        'file': null,
        'command': null,
        'script': null,

        'linesOfHistory': 0, // 0 for infinite history
        'linesToTail': 250,
        'wrapLines': true,

        'hideToolbar': false,
        'showConfig': false,
        'showLoadingOverlay': false,

        'socket': null,
        'isConnected': false
    },
    created: function () {
        this.backendConnect();
        this.command = this.allowCommandNames[0];
    },
    computed: {
        scriptInputEnabled: function () {
            return this.commandScripts[this.command] !== "";
        },
        downloadLink: function () {
            if (this.file) {
                var suffix = 'files/?path=' + this.file.path;
                var href = window.location.href.split('?')[0]
                return endsWith(window.location.pathname, '/') ?
                    href + suffix :
                    href.replace(/[^\/]+$/, suffix);
            }
            return '#';
        }
    },
    methods: {
        clearLogview: function () {
            this.$refs.logview.clearLines();
        },
        backendConnect: function () {
            console.log('connecting to ' + apiURL);
            this.showLoadingOverlay = true;
            this.socket = new SockJS(apiURL);
            this.socket.onopen = this.onBackendOpen;
            this.socket.onclose = this.onBackendClose;
            this.socket.onmessage = this.onBackendMessage;
        },
        onBackendOpen: function () {
            console.log('connected to backend');
            this.isConnected = true;
            this.refreshFiles();
        },
        onBackendClose: function () {
            console.log('disconnected from backend');
            this.isConnected = false;
            backendConnect = this.backendConnect;
            window.setTimeout(function () {
                backendConnect();
            }, 1000);
        },
        onBackendMessage: function (message) {
            var data = JSON.parse(message.data);

            if (data.constructor === Object) {
                // Reshape into something that vue-multiselect :group-select can use.
                var fileList = [];
                Object.keys(data.entries).forEach(function (key) {
                    var group = ("__default__" === key) ? "Ungrouped Files" : key;
                    fileList.push({
                        "group": group,
                        "files": data.entries[key]
                    });
                });

                this.fileList =  data.grouped ? fileList : fileList[0].files;
                this.groups = data.groups;
                this.grouped = data.grouped;

                // Set file input to first entry in list.
                if (!this.file) {
                    this.file = fileList[0].files[0];
                }
            } else {
                var stream = data[0];
                var line = data[1];
                this.$refs.logview.write(stream, line);
            }
        },
        refreshFiles: function () {
            console.log("updating file list");
            this.socket.send("list" + window.location.search);
        },
        notifyBackend: function () {
            var msg = {
                command: this.command,
                script: this.script,
                entry: this.file,
                nlines: this.linesToTail
            };
            console.log("sending msg: ", msg);
            this.clearLogview();
            this.socket.send(JSON.stringify(msg));
        },
        clearInput: function () {
            this.script = "";
            this.notifyBackend();
        }
    },
    watch: {
        isConnected: function (val) {
            this.showLoadingOverlay = !val;
        },
        wrapLines: function (val) {
            this.$refs.logview.toggleWrapLines(val);
        },
        command: function (val) {
            if (val && this.isConnected) {
                this.script = this.commandScripts[val];
                this.notifyBackend();
                this.$nextTick(function () {
                    this.$refs.script_input.select();
                    this.$refs.script_input.focus();
                })
            }
        },
        file: function (val) {
            if (val && this.isConnected) {
                this.notifyBackend();
            }
        }
    }
});
