class MDQ {

    /**
     * Container for holding the questions as they're loaded, prior
     * to output on the page. 
     */
    loadedQuestions = [];

    /**
     * Container for all of the questions that can be loaded. This may
     * be everything if the questions aren't in groups, or just questions
     * from the selected groups. 
     */
    allQuestions = []

    /**
     * Question groups that are currently selected.   
     */
    currentGroups = [];

    /**
     * Paths to remote resources that will be loaded prior to the questions.
     */
    paths = {
        'bootstrap5': 'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css',
        'marked': 'https://cdnjs.cloudflare.com/ajax/libs/marked/3.0.7/marked.min.js',
        'mathjax': 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-svg-full.min.js',
        'mermaid': 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/8.13.2/mermaid.min.js',
        'prismJS': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/prism.min.js',
        'prismAutoload': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/plugins/autoloader/prism-autoloader.min.js',
        'prismCSS': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/themes/prism.min.css',
    };

    /**
     * Holder for the the element that the questions are loading into. The
     * config element can either pass a qualified element or a query selector.
     * If it's a query selector, and multiple are found, the first one is used. 
     */
    parentElement = null;

    /**
     * Get everything setup and initialize the page. 
     * @param {*} config 
     */
    constructor(config) {
        let def = {
            autoStart: true,
            count: 5,
            parent: '',
            lang: {
                correct: 'Correct',
                incorrect: 'Incorrect',
                check: 'Check',
                help: 'Help',
                'true': 'True',
                'false': 'False',
                reload: 'Reload',
            }, questions: [],
            theme: '',
            css: true,
            syntaxHighlight: true,
            credit: true,
            reload: true,
            stripRaw: true,
            loadScripts: true,
        };
        this.config = { ...def, ...config };

        this.loadedQuestions = [];
        this.allQuestions = [];

        // Set the parent element. 
        if (this.config.parent == '') {
            // Body
            this.parentElement = document.body;
        } else if (typeof this.config.parent === 'string') {
            this.parentElement = document.querySelector(this.config.parent);
            if (this.parentElement === null) {
                // Wasn't found
                console.error('Could not find parent element ' + this.config.parent);
                return;
            }
        } else if (this.config.parent instanceof HTMLElement) {
            this.parentElement = this.config.parent;
        } else {
            throw new Error('Invalid parent element.');
        }

        if (this.config.autoStart) {
            this.init();
        }
    }

    /**
     * Build, or rebuild the page
     * 
     * Everything this needs should be in instance variables filled by the construtor. 
     */
    async init() {
        // Load questions, going in to groups if requested
        if (Array.isArray(this.config.questions)) {
            // Just load them all
            this.allQuestions = this.config.questions;
        } else if (typeof this.config.questions === 'object') {
            // Object, need to parse and look for groups
            let groups = Object.keys(this.config.questions);
            if (this.currentGroups.length < 1) {
                // Can't have zero groups, so default to all
                this.currentGroups = groups;
            }

            // Go through and add questions for any selected groups
            this.currentGroups.forEach(group => {
                if (group in this.config.questions) {
                    this.allQuestions = this.allQuestions.concat(this.config.questions[group]);
                } else {
                    console.error('Cannot find key ' + group + ' in questions');
                }
            });

        }

        if (this.allQuestions.length < 1) {
            console.error('No questions found in config');
            return;
        }

        // Shuffle the questions
        for (let i = this.allQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this.allQuestions[i];
            this.allQuestions[i] = this.allQuestions[j];
            this.allQuestions[j] = temp;
        }

        window.Prism = window.Prism || {};
        Prism.manual = true;
        await this.loadFiles();
        this.loadScripts(this.getScripts(), this.buildPage.bind(this));
    }

    /**
     * Remotely loads the markdown files and stores them in the 
     * loadedQuestions property. This also calls the formatting
     * functions to get the HTML for each question and queue
     * any needed remote CSS or JavaScript files. 
     */
    async loadFiles() {
        for (const url of this.allQuestions) {
            let response = await fetch(url);
            if (response.status >= 200 && response.status < 400) {
                let data = await response.text();
                this.loadedQuestions.push(new MDQQuestion(data, url, this.config));
            }
            if (this.loadedQuestions.length >= this.config.count) {
                break;
            }
        }
    }
    /**
     * Returns a list of scripts or stylesheets that need to be 
     * loaded based on contents of the queued questions. 
     */
    getScripts() {
        // If script loading disabled, then return an empty list so 
        // nothing loads. 
        if (!this.config.loadScripts) {
            return [];
        }
        let scripts = [];
        scripts.push(this.paths.marked); // always need marked
        if (this.config.theme == 'bootstrap5') {
            scripts.push(this.paths.bootstrap5);
        }

        let mathjax = false;
        let mermaid = false;
        let prism = false;

        this.loadedQuestions.forEach(q => {
            if (!mathjax && q.needsMathJax()) {
                scripts.push(this.paths.mathjax);
                mathjax = true;
            }
            if (!mermaid && q.needsMermaid()) {
                scripts.push(this.paths.mermaid);
                mermaid = true;
            }
            if (!prism && q.needsPrism()) {
                scripts.push(this.paths.prismCSS);
                scripts.push(this.paths.prismJS);
                scripts.push(this.paths.prismAutoload);
                prism = true;
            }
        });

        return scripts;
    }



    /**
     * Returns an object containing the different parts of the
     * markdown content.
     * 
     * Not all questions will have all types. 
     * 
     * @param {*} content 
     */
    getParts(content) {
        let ret = {
            'frontMatter': { 'title': '', 'type': '', 'answer': '' },
            'body': '',
            'explanation': ''
        };

        return ret;
    }

    /**
     * Load scripts and style sheets from a list - scriptList - and
     * then call callback function after they've all loaded. This
     * will call itself recursively as the scripts onload so that 
     * this acts like a synchronous load. 
     * 
     * @param {*} scriptList 
     * @param {*} callback 
     */
    loadScripts(scriptList, callback) {

        if (scriptList.length < 1) {
            callback();
            return;
        }
        let currentScript = scriptList.shift();

        if (this.styleLoaded(currentScript) || this.scriptLoaded(currentScript)) {
            // Won't ever get to the callback otherwise if the script
            // is already loaded
            this.loadScripts(scriptList, callback);
            return;
        }
        else if (currentScript.endsWith('.js')) {
            var script = document.createElement('script');
            script.src = currentScript;
            script.async = false;
            script.addEventListener('load', () => {
                this.loadScripts(scriptList, callback);
            });
            document.head.appendChild(script);
        } else if (currentScript.endsWith('.css')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = currentScript;
            link.media = 'all';
            link.addEventListener('load', () => {
                this.loadScripts(scriptList, callback);
            })
            document.head.appendChild(link);
        }
    }
    styleLoaded(url) {
        return !!document.querySelector('style[href="' + url + '"]');
    }

    scriptLoaded(url) {
        return !!document.querySelector('script[src="' + url + '"]');
    }

    /**
     * Build the HTML for the page
     */
    buildPage() {
        // Add the MDQ CSS if requested, and not already loaded on page
        let cssLoaded = !!document.querySelector('style#mdq-css');
        if (!cssLoaded && this.config.css) {
            var s = document.createElement('style');
            s.setAttribute('type', 'text/css');
            s.setAttribute('id', 'mdq-css');
            s.appendChild(document.createTextNode(this.CSSContents()));
            document.head.appendChild(s);
        }

        var wrapper = document.createElement("div");

        let topLink = document.createElement('a');
        topLink.setAttribute('name', 'mdq-top');
        wrapper.appendChild(topLink);

        wrapper.setAttribute('class', 'mdq-wrap ' + (this.config.theme == 'bootstrap5' ? 'container' : ''));

        // @todo add buttons for question groups

        this.loadedQuestions.forEach(question => {
            wrapper.appendChild(question.element(this.config.theme));
        });

        if (this.config.reload) {
            let reloadDiv = document.createElement('div');
            reloadDiv.classList.add('mdq-reload');
            let reloadButton = document.createElement('button');
            if (this.isBootstrap()) {
                reloadButton.classList.add('btn', 'btn-primary');
            }
            reloadButton.innerHTML = mdq.config.lang.reload;
            reloadButton.addEventListener('click', evt => {
                let parent = mdq.parentElement();
                let anchor = document.createElement('a');
                anchor.setAttribute('name', 'mdq-top');

                parent.innerHTML = '';
                parent.appendChild(anchor);

                location.hash = '#mdq-top';
                this.init(mdq.config);
            });
            reloadDiv.appendChild(reloadButton);
            wrapper.appendChild(reloadDiv);
        }

        if (this.config.credit) {
            var creditDiv = document.createElement('div');
            creditDiv.classList.add('mdq-credit');
            creditDiv.innerHTML = 'Quiz script by <a href="https://compsci.rocks/scripts/" target="_blank">CompSci.rocks</a>';
            wrapper.appendChild(creditDiv);
        }

        // Clear out existing parent to get ready for the new content
        this.parentElement.innerHTML = '';

        this.parentElement.appendChild(wrapper);
    }

    /**
     * Returns a string converted to camelCase
     * @see https://stackoverflow.com/a/2970588/1561431
     * @param {*} str 
     * @returns 
     */
    static toCamelCase(str) {
        return str
            .replace(/\s(.)/g, function ($1) { return $1.toUpperCase(); })
            .replace(/\s/g, '')
            .replace(/^(.)/, function ($1) { return $1.toLowerCase(); });
    }
    /**
     * CSS that will optionally be inserted on to page. This is replaced in the dist 
     * version of this script with SCSS from mdq.scss prior to minification. 
     * @returns 
     */
    CSSContents() {
        return `%%CSS%%`;
    }

    /**
     * Returns the number of currently selected question groups
     */
    groupCount() {
        return this.currentGroups.length;
    }

    /**
     * Returns true if the theme is set to bootstrap5
     */
    isBootstrap() {
        return this.config.theme == 'bootstrap5';
    }

    /**
     * Returned a shuffled array
     * @param {*} array 
     */
    static shuffle(array) {
        // Shuffle the questions
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }
}