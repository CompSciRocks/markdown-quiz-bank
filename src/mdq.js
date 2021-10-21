/**
 * Main script for Markdown Question Quiz. This hands off to other files
 * as needed for actually handling the grading and layout. 
 */
var mermaid_config = {
    startOnLoad: false
};
var mdq = {

    /**
     * URLs to use for loading external JS libraries, most likely
     * from a CDN. These will be loaded as needed depeding on the
     * content of the questions. 
     */
    path: {
        'bootstrap5': 'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css',
        'marked': 'https://cdnjs.cloudflare.com/ajax/libs/marked/3.0.7/marked.min.js',
        'mathjax': 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-svg-full.min.js',
        'mermaid': 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/8.13.2/mermaid.min.js',
        'prismJS': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/prism.min.js',
        'prismAutoload': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/plugins/autoloader/prism-autoloader.min.js',
        'prismCSS': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/themes/prism.min.css',
    },

    /**
     * Holder for the questions as they're loaded remotely before
     * actually rendering to the page.  
     */
    loadedQuestions: [],

    /**
     * Stores the config option passed after normalizing so that it
     * can be accessed by all the methods. 
     */
    config: {},

    /**
     * Setup the page, passing any config options needed. Normalizes the
     * config property to include required properties with their default
     * values if they're not already specified. 
     */
    init: async function (config) {
        let def = {
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
        };
        this.config = { ...def, ...config };

        this.loadedQuestions = [];

        // Shuffle the questions
        for (let i = this.config.questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this.config.questions[i];
            this.config.questions[i] = this.config.questions[j];
            this.config.questions[j] = temp;
        }

        window.Prism = window.Prism || {};
        Prism.manual = true;

        await this.loadFiles();
        await this.loadScripts(this.getScripts(), this.buildPage);

        // this.buildPage();
    },

    /**
     * Load scripts and style sheets from a list - scriptList - and
     * then call callback function after they've all loaded. This
     * will call itself recursively as the scripts onload so that 
     * this acts like a synchronous load. 
     * 
     * @param {*} scriptList 
     * @param {*} callback 
     */
    loadScripts: function (scriptList, callback) {

        if (scriptList.length < 1) {
            callback();
            return;
        }
        let currentScript = scriptList.shift();

        if (mdq.styleLoaded(currentScript) || mdq.scriptLoaded(currentScript)) {
            // Won't ever get to the callback otherwise if the script
            // is already loaded
            callback();
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
    },

    styleLoaded: function (url) {
        return !!document.querySelector('style[href="' + url + '"]');
    },

    scriptLoaded: function (url) {
        return !!document.querySelector('script[src="' + url + '"]');
    },

    /**
     * Returns a list of scripts or stylesheets that need to be 
     * loaded based on contents of the queued questions. 
     */
    getScripts: function () {
        scripts = [];
        scripts.push(this.path.marked); // always need marked
        if (mdq.config.theme == 'bootstrap5') {
            scripts.push(this.path.bootstrap5);
        }

        let mathjax = false;
        let mermaid = false;
        let prism = false;

        mdq.loadedQuestions.forEach(q => {
            if (!mathjax && mdqQuestions.needsMathJax(q)) {
                scripts.push(this.path.mathjax);
                mathjax = true;
            }
            if (!mermaid && mdqQuestions.needsMermaid(q)) {
                scripts.push(this.path.mermaid);
                mermaid = true;
            }
            if (!prism && mdqQuestions.needsPrism(q)) {
                scripts.push(this.path.prismCSS);
                scripts.push(this.path.prismJS);
                scripts.push(this.path.prismAutoload);
                prism = true;
            }
        });

        return scripts;
    },

    /**
     * Take the loaded questions and build the HTML for the page
     */
    buildPage: function () {

        // Add the MDQ CSS if requested
        let cssLoaded = !!document.querySelector('style#mdq-css');
        if (!cssLoaded && mdq.config.css) {
            var s = document.createElement('style');
            s.setAttribute('type', 'text/css');
            s.setAttribute('id', 'mdq-css');
            s.appendChild(document.createTextNode(mdqCSS.cssContents));
            document.head.appendChild(s);
        }

        var wrapper = document.createElement("div");

        let topLink = document.createElement('a');
        topLink.setAttribute('name', 'mdq-top');
        wrapper.appendChild(topLink);

        wrapper.setAttribute('class', 'mdq-wrap ' + (mdq.config.theme == 'bootstrap5' ? 'container' : ''));
        mdq.loadedQuestions.forEach(question => {
            wrapper.appendChild(mdq.questionElement(question));
        });

        if (mdq.config.reload) {
            let reloadDiv = document.createElement('div');
            reloadDiv.classList.add('mdq-reload');
            let reloadButton = document.createElement('button');
            if (mdq.isBootstrap()) {
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
                mdq.init(mdq.config);
            });
            reloadDiv.appendChild(reloadButton);
            wrapper.appendChild(reloadDiv);
        }

        if (mdq.config.credit) {
            var creditDiv = document.createElement('div');
            creditDiv.classList.add('mdq-credit');
            creditDiv.innerHTML = 'Quiz script by <a href="https://compsci.rocks/scripts/" target="_blank">CompSci.rocks</a>';
            wrapper.appendChild(creditDiv);
        }

        // Clear out existing questions
        let existingQuestions = document.querySelectorAll('div.mdq-wrap');
        existingQuestions.forEach(el => {
            el.remove();
        });

        if (mdq.config.parent == '') {
            document.body.appendChild(wrapper);
        } else {
            document.getElementById(mdq.config.parent).appendChild(wrapper);
        }

        // Don't need to add anything, but do need to
        // attach events to all the inputs
        let inputs = document.querySelectorAll('div.mdq-question input[data-hash]');
        inputs.forEach((el) => {
            el.addEventListener('keyup', evt => {
                el.classList.remove('correct', 'incorrect');
                document.querySelector('button[data-hash="' + el.getAttribute('data-hash') + '"]').disabled = false;
            });
        });
        let sels = document.querySelectorAll('div.mdq-question select[data-hash]');
        sels.forEach(sel => {
            sel.value = -1; // Start unselected
            sel.addEventListener('change', evt => {
                sel.classList.remove('correct', 'incorrect');
                document.querySelector('button[data-hash="' + sel.getAttribute('data-hash') + '"]').disabled = false;
            });
        });

        // Fix mermaid elements
        let mermaidPre = document.querySelectorAll('pre code.language-mermaid');
        mermaidPre.forEach(el => {
            let parent = el.parentElement;
            let newDiv = document.createElement('div');
            newDiv.classList.add('mermaid');
            newDiv.innerHTML = el.innerHTML;
            el.parentElement.replaceChild(newDiv, el);
        });

        if (typeof MathJax !== 'undefined' && MathJax.typeset) {
            MathJax.typeset();
        }

        if (Prism.highlightAll) {
            Prism.highlightAll(mdq.config.parent ? document.getElementById(mdq.config.parent) : document);
        }
    },


    /**
     * Returns a div element for an individual question
     * @param {*} question 
     */
    questionElement: function (question) {
        var div = document.createElement('div');
        div.setAttribute('class', 'mdq-question');
        div.setAttribute('data-hash', question.hash);
        div.setAttribute('id', question.hash);

        let comment = [];
        if (question.file) {
            comment.push('file: ' + question.file);
        }
        if (question.frontMatter.title) {
            comment.push('title: ' + question.frontMatter.title);
        }
        let commentNode = document.createComment(comment.join(', '));
        div.appendChild(commentNode);

        let divContent = document.createElement('div');
        divContent.setAttribute('class', 'md-question-body');
        divContent.innerHTML = mdq.formatQuestion(question);

        div.appendChild(divContent);

        let qType = '';
        if (mdq.isMultipleChoice(question)) {
            let divMC = mdqQuestions.mcHTML(question);
            divMC.addEventListener('click', (evt) => {
                mdqQuestions.highlightMC(evt);
            });
            div.appendChild(divMC);
            qType = 'MC';
        } else if (mdq.isTrueFalse(question)) {
            let divTF = mdqQuestions.tfHTML(question);
            div.appendChild(divTF);
            qType = 'TF';
        }

        let divButtons = document.createElement('div');
        divButtons.setAttribute('class', 'mdq-buttons');
        let btnCheck = document.createElement('button');
        if (mdq.isBootstrap()) {
            btnCheck.classList.add('btn', 'btn-primary');
        }
        btnCheck.setAttribute('data-type', qType);
        btnCheck.setAttribute('data-hash', question.hash);
        btnCheck.setAttribute('disabled', true);

        btnCheck.addEventListener('click', (evt) => {
            mdqQuestions.checkQuestion(evt.currentTarget.getAttribute('data-hash'));
        });
        btnCheck.innerHTML = mdq.config.lang.check + '...';
        divButtons.appendChild(btnCheck);

        if (question.sections.explanation !== undefined) {
            let btnExplain = document.createElement('button');
            btnExplain.setAttribute('disabled', true);
            btnExplain.setAttribute('data-help', 1);
            btnExplain.setAttribute('data-hash', question.hash);
            if (mdq.isBootstrap()) {
                btnExplain.classList.add('btn', 'btn-secondary');
            }
            btnExplain.addEventListener('click', (evt) => {
                let elExplain = document.querySelector('div.mdq-explanation[data-hash="' + question.hash + '"]');
                if (elExplain) {
                    elExplain.style.display = 'block';
                }
            });
            btnExplain.innerHTML = this.config.lang.help + '...';
            divButtons.appendChild(btnExplain);
        }
        div.appendChild(divButtons);

        if (question.sections.explanation !== undefined) {
            let divExplanation = document.createElement('div');
            divExplanation.setAttribute('class', 'mdq-explanation');
            divExplanation.setAttribute('data-hash', question.hash);
            divExplanation.style.display = 'none';
            divExplanation.innerHTML = marked(question.sections.explanation);
            div.appendChild(divExplanation);
        }

        return div;
    },

    /**
     * Parse the markdown to HTML. Marked will be doing most
     * of the work, but we'll hand off as needed for custom 
     * stuff. 
     * 
     * @param {*} question
     */
    formatQuestion: function (question) {
        let parsed = marked(question.markdown);
        if (mdq.isFIB(question)) {
            parsed = mdqQuestions.parseFields(parsed, question);
        }
        return parsed;
    },



    /**
     * Remotely loads the markdown files and stores them in the 
     * loadedQuestions property. This also calls the formatting
     * functions to get the HTML for each question and queue
     * any needed remote CSS or JavaScript files. 
     */
    loadFiles: async function (idx) {
        for (const url of this.config.questions) {
            let response = await fetch(url);
            if (response.status >= 200 && response.status < 400) {
                let data = await response.text();
                this.loadedQuestions.push(this.fileInfo(data, url));
            }
            if (this.loadedQuestions.length >= this.config.count) {
                break;
            }
        }
    },

    /**
     * Returns an object with information about a single question
     * file that can be put into the loadedQuestions array. 
     * @param {*} fileContent 
     */
    fileInfo: function (fileContent, url) {
        fileContent = fileContent.trim();
        if (mdq.config.stripRaw) {
            fileContent = fileContent.replace(/{%\s*?(end)?raw\s*?%}/sg, '').trim();
        }
        let ret = {};

        ret.file = url;

        // Strip out the raw / endraw lines that appear to be needed
        // when serving from a Jekyll generated site
        ret.rawContent = fileContent;

        // Need a randomish identifier for later
        ret.hash = Math.random().toString(36).slice(-10);

        // Front matter
        ret.frontMatter = {};
        let fmMatch = fileContent.match(/^---\s*?(.*?)---/s);
        if (fmMatch) {
            ret.frontMatter = this.parseFrontMatter(fmMatch[1].trim());
        }
        fileContent = fileContent.replace(/^---\s*?(.*?)---/s, '').trim();

        // Split on the section headers
        let sections = fileContent.split(/---[\t ]*?([A-Za-z ]+)/g);
        ret.markdown = sections.shift().trim();

        ret.sections = {};
        for (let i = 0; i < sections.length - 1; i += 2) {
            ret.sections[this.toCamelCase(sections[i].trim())] = sections[i + 1].trim();
        }
        return ret;
    },

    /**
     * Parse front matter into an object, with the header as key
     * @param {*} frontMatter 
     */
    parseFrontMatter: function (frontMatter) {
        let ret = {};
        let lines = frontMatter.split(/\n\r?/);
        lines.forEach(el => {
            el = el.trim();
            let sp = el.split(/\s*?:\s*?/);
            if (sp.length == 2) {
                ret[this.toCamelCase(sp[0].trim())] = sp[1].trim();
            }
        });

        if (typeof ret.answer === 'undefined' && typeof ret.ans !== 'undefined') {
            ret.answer = ret.ans;
        }

        return ret;
    },

    /**
     * Returns an object containing the different parts of the
     * markdown content.
     * 
     * Not all questions will have all types. 
     * 
     * @param {*} content 
     */
    getParts: function (content) {
        let ret = {
            'frontMatter': { 'title': '', 'type': '', 'answer': '' },
            'body': '',
            'explanation': ''
        };

        return ret;
    },

    /**
     * Returns a string converted to camelCase
     * @see https://stackoverflow.com/a/2970588/1561431
     * @param {*} str 
     * @returns 
     */
    toCamelCase: function (str) {
        return str
            .replace(/\s(.)/g, function ($1) { return $1.toUpperCase(); })
            .replace(/\s/g, '')
            .replace(/^(.)/, function ($1) { return $1.toLowerCase(); });
    },

    /**
     * Returns true if the question passed is a multiple choice question
     * according to the top matter. 
     * 
     * Since MC is also the default type, we'll assume it's a multiple choice
     * question if there is an answers section in the question.
     * 
     * @param {*} question 
     */
    isMultipleChoice: function (question) {
        let qType = question.frontMatter.type ?? '';
        qType = qType.trim();
        if (qType.toLowerCase() == 'mc' || qType.match(/^mult.*?/i)) {
            return true;
        } else if (qType == '') {
            if (question.sections.answers !== undefined) {
                return true;
            }
        }
        return false;
    },

    isFIB: function (question) {
        let qType = question.frontMatter.type ?? '';
        qType = qType.trim();
        if (qType.toLowerCase() == 'fib' || qType.match(/^fill.*?/i)) {
            return true;
        }
        return false;
    },

    /**
     * Check if a question is true / false
     * 
     * This is done by looking at the type field in front matter. Anything 
     * starting with t - case-insensitive - is considered a true false question.
     * 
     * @param {*} question 
     */
    isTrueFalse: function (question) {
        let qType = question.frontMatter.type ?? '';
        return !!qType.match(/^t.*?/i);
    },

    /**
     * Returned a shuffled array
     * @param {*} array 
     */
    shuffle: function (array) {
        // Shuffle the questions
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    },

    /**
     * Returns true if the theme is set to bootstrap5
     */
    isBootstrap: function () {
        return mdq.config.theme == 'bootstrap5';
    },

    parentElement: function () {
        return mdq.config.parent ? document.getElementById(mdq.config.parent) : document.body;
    },

    decodeEntities: function (html) {
        let txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    },
}