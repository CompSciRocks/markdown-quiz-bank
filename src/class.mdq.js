var mermaid_config = {
    startOnLoad: false
};

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
     * Used to identify this particular set of questions so there can be multiple
     * on the same page. 
     */
    hash = null;

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

        this.hash = Math.random().toString(36).slice(-10);

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
        this.allQuestions = [];
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
        this.loadedQuestions = [];
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
        topLink.setAttribute('name', 'mdq-top-' + this.hash);
        wrapper.appendChild(topLink);

        wrapper.setAttribute('class', 'mdq-wrap ' + (this.config.theme == 'bootstrap5' ? 'container' : ''));

        if (this.hasGroups()) {
            wrapper.appendChild(this._elementButtons());
        }

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

                this.init(this.config);
                location.hash = '#mdq-top-' + this.hash;
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

        // Attach event handlers to clear the styling from FIB inputs and selects as
        // they change. The styling is added by the check button for this element. 
        this.parentElement.querySelectorAll('input[data-type="fib"]').forEach(input => {
            input.addEventListener('keydown', evt => {
                let hash = evt.target.getAttribute('data-hash');
                evt.target.classList.remove('correct', 'incorrect');
                this.parentElement.querySelector('button[data-hash="' + hash + '"]').disabled = false;
            });
        });
        this.parentElement.querySelectorAll('select[data-type="sel"]').forEach(input => {
            input.selectedIndex = -1;
            input.addEventListener('change', evt => {
                let hash = evt.target.getAttribute('data-hash');
                evt.target.classList.remove('correct', 'incorrect');
                this.parentElement.querySelector('button[data-hash="' + hash + '"]').disabled = false;
            });
        });

        // Fix mermaid elements
        let mermaidPre = this.parentElement.querySelectorAll('pre code.language-mermaid');
        mermaidPre.forEach(el => {
            let parent = el.parentElement;
            let newDiv = document.createElement('div');
            newDiv.classList.add('mermaid');
            newDiv.innerHTML = el.innerHTML;
            el.parentElement.replaceChild(newDiv, el);
        });
        mermaid.init({}, this.parentElement.querySelectorAll('div.mermaid'));

        if (typeof MathJax !== 'undefined' && MathJax.typeset) {
            MathJax.typeset();
        }

        if (Prism.highlightAll) {
            Prism.highlightAll(this.parentElement);
        }

    }

    /**
     * Returns a DOM element containing the buttons to switch between groups
     */
    _elementButtons() {
        let groupButtons = document.createElement('div');
        groupButtons.classList.add('mdq-question-groups');
        if (this.isBootstrap()) {
            // Bootstrap button group
            groupButtons.classList.add('btn-group', 'mdq-button-group');
            this.groupList().forEach(group => {
                let b = document.createElement('button');
                b.classList.add('btn', 'mdq-button');
                if (this.currentGroups.includes(group)) {
                    b.classList.add('btn-primary');
                    b.setAttribute('data-sel', 1);
                } else {
                    b.classList.add('btn-outline-primary');
                    b.setAttribute('data-sel', 0);
                }
                b.innerText = group;
                b.setAttribute('data-group', group);
                b.addEventListener('click', evt => {
                    let btn = evt.target;
                    let currentlySelected = MDQ.isTruthy(btn.getAttribute('data-sel'));
                    if (currentlySelected) {
                        // Can only deselect if there's more than one selected
                        let cnt = btn.parentElement.querySelectorAll('button[data-sel="1"]').length;
                        if (cnt > 1) {
                            let idx = this.currentGroups.indexOf(btn.getAttribute('data-group'));
                            if (idx >= 0) {
                                this.currentGroups.splice(idx, 1);
                            }
                        } else {
                            return; // Can't deselect the only one selected and don't want to refresh
                        }
                    } else {
                        // Add it, doesn't matter the number selected
                        this.currentGroups.push(btn.getAttribute('data-group'));
                    }
                    this.init(this.config);
                });
                groupButtons.appendChild(b);
            });
        } else {
            // Checkboxes 
            this.groupList().forEach(group => {
                let lbl = document.createElement('label');
                let cb = document.createElement('input');
                cb.setAttribute('type', 'checkbox');
                cb.setAttribute('data-group', group);
                cb.checked = mdq.currentGroups.includes(group);
                cb.addEventListener('change', function (evt) {
                    let currentlySelected = this.checked;

                    if (!currentlySelected) {
                        let cnt = this.parentElement.parentElement.querySelectorAll('input[type="checkbox"]:checked').length;
                        if (cnt < 1) {
                            // Block deselect and update if it was the only one selected
                            this.checked = true;
                            return;
                        }
                        // Remove it from the list and refresh
                        let idx = mdq.currentGroups.indexOf(this.getAttribute('data-group'));
                        if (idx >= 0) {
                            mdq.currentGroups.splice(idx, 1);
                        }
                    } else {
                        // Add it, doesn't matter how many are already selected
                        mdq.currentGroups.push(this.getAttribute('data-group'));
                    }
                    mdq.init(mdq.config);
                });

                let span = document.createElement('span');
                span.innerText = group;
                lbl.appendChild(cb);
                lbl.appendChild(span);
                groupButtons.appendChild(lbl);
            });
        }
        return groupButtons;
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
     * Returns true if the value is "truthy"
     * @param {*} val 
     */
    static isTruthy(val) {
        val = val | false;

        if (typeof val === 'string') {
            val = val.toLowerCase();
        }
        if (val == true || val == 'true' || val == '1') {
            return true;
        }
        return false;
    }

    static decodeEntities(html) {
        let txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
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

    hasGroups() {
        return typeof this.config.questions === 'object' && !Array.isArray(this.config.questions);
    }

    /**
     * Returns the names of groups, or an empty array if there are no groups
     */
    groupList() {
        if (!this.hasGroups()) {
            return [];
        }
        return Object.keys(this.config.questions);
    }
}