SystemJS.config({
	transpiler: "ts",
	typescriptOptions: {
		"typeCheck": true,
		"tsconfig": true
	},
	packages: {
		"src": {
			"defaultExtension": "ts",
			"meta": {
				"*.ts": {
					"loader": "ts"
				}
			}
		}
	}
});

SystemJS.config({
	packageConfigPaths: [
		"github:*/*.json",
		"npm:@*/*.json",
		"npm:*.json"
	],
	map: {
		"assert": "github:jspm/nodelibs-assert@0.2.0-alpha",
		"buffer": "github:jspm/nodelibs-buffer@0.2.0-alpha",
		"core-js": "npm:core-js@2.2.0",
		"events": "github:jspm/nodelibs-events@0.2.0-alpha",
		"fetch-mock": "npm:fetch-mock@4.2.0",
		"fs": "github:jspm/nodelibs-fs@0.2.0-alpha",
		"http": "github:jspm/nodelibs-http@0.2.0-alpha",
		"https": "github:jspm/nodelibs-https@0.2.0-alpha",
		"isomorphic-fetch": "npm:isomorphic-fetch@2.2.1",
		"path": "github:jspm/nodelibs-path@0.2.0-alpha",
		"process": "github:jspm/nodelibs-process@0.2.0-alpha",
		"reflect-metadata": "npm:reflect-metadata@0.1.3",
		"rxjs": "npm:rxjs@5.0.0-beta.2",
		"stream": "github:jspm/nodelibs-stream@0.2.0-alpha",
		"string_decoder": "github:jspm/nodelibs-string_decoder@0.2.0-alpha",
		"ts": "github:frankwallis/plugin-typescript@4.0.2",
		"url": "github:jspm/nodelibs-url@0.2.0-alpha",
		"util": "github:jspm/nodelibs-util@0.2.0-alpha",
		"zlib": "github:jspm/nodelibs-zlib@0.2.0-alpha"
	},
	packages: {
		"npm:fetch-mock@4.2.0": {
			"map": {
				"node-fetch": "npm:node-fetch@1.3.3"
			}
		},
		"github:frankwallis/plugin-typescript@4.0.2": {
			"map": {
				"typescript": "npm:typescript@1.8.9"
			}
		},
		"github:jspm/nodelibs-buffer@0.2.0-alpha": {
			"map": {
				"buffer-browserify": "npm:buffer@4.5.0"
			}
		},
		"github:jspm/nodelibs-http@0.2.0-alpha": {
			"map": {
				"http-browserify": "npm:stream-http@2.2.0"
			}
		},
		"github:jspm/nodelibs-stream@0.2.0-alpha": {
			"map": {
				"stream-browserify": "npm:stream-browserify@2.0.1"
			}
		},
		"github:jspm/nodelibs-string_decoder@0.2.0-alpha": {
			"map": {
				"string_decoder-browserify": "npm:string_decoder@0.10.31"
			}
		},
		"github:jspm/nodelibs-url@0.2.0-alpha": {
			"map": {
				"url-browserify": "npm:url@0.11.0"
			}
		},
		"github:jspm/nodelibs-zlib@0.2.0-alpha": {
			"map": {
				"zlib-browserify": "npm:browserify-zlib@0.1.4"
			}
		},
		"npm:browserify-zlib@0.1.4": {
			"map": {
				"pako": "npm:pako@0.2.8",
				"readable-stream": "npm:readable-stream@2.0.6"
			}
		},
		"npm:buffer@4.5.0": {
			"map": {
				"base64-js": "npm:base64-js@1.1.1",
				"ieee754": "npm:ieee754@1.1.6",
				"isarray": "npm:isarray@1.0.0"
			}
		},
		"npm:encoding@0.1.12": {
			"map": {
				"iconv-lite": "npm:iconv-lite@0.4.13"
			}
		},
		"npm:isomorphic-fetch@2.2.1": {
			"map": {
				"node-fetch": "npm:node-fetch@1.3.3",
				"whatwg-fetch": "npm:whatwg-fetch@0.11.0"
			}
		},
		"npm:node-fetch@1.3.3": {
			"map": {
				"encoding": "npm:encoding@0.1.12"
			}
		},
		"npm:readable-stream@2.0.6": {
			"map": {
				"core-util-is": "npm:core-util-is@1.0.2",
				"inherits": "npm:inherits@2.0.1",
				"isarray": "npm:isarray@1.0.0",
				"process-nextick-args": "npm:process-nextick-args@1.0.6",
				"string_decoder": "npm:string_decoder@0.10.31",
				"util-deprecate": "npm:util-deprecate@1.0.2"
			}
		},
		"npm:stream-browserify@2.0.1": {
			"map": {
				"inherits": "npm:inherits@2.0.1",
				"readable-stream": "npm:readable-stream@2.0.6"
			}
		},
		"npm:stream-http@2.2.0": {
			"map": {
				"builtin-status-codes": "npm:builtin-status-codes@2.0.0",
				"inherits": "npm:inherits@2.0.1",
				"to-arraybuffer": "npm:to-arraybuffer@1.0.1",
				"xtend": "npm:xtend@4.0.1"
			}
		},
		"npm:url@0.11.0": {
			"map": {
				"punycode": "npm:punycode@1.3.2",
				"querystring": "npm:querystring@0.2.0"
			}
		}
	}
});
