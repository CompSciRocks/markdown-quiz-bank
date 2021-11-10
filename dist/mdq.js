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
     * Container for all of the questions that can be loaded. This may
     * be everything if the questions aren't in groups, or just questions
     * from the selected groups. 
     */
    allQuestions: [],

    /**
     * Question groups that are currently selected. 
     */
    currentGroups: [],

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

        // Add buttons if there are question groups
        if (mdq.hasGroups()) {
            let groupButtons = document.createElement('div');
            if (mdq.isBootstrap()) {
                // Button group
                groupButtons.classList.add('mdq-button-group');
                groupButtons.classList.add('btn-group')
                mdq.groupList().forEach(group => {
                    let b = document.createElement('button');
                    b.classList.add('btn');
                    b.classList.add('mdq-button');
                    if (mdq.currentGroups.includes(group)) {
                        b.classList.add('btn-primary');
                        b.setAttribute('data-sel', 1);
                    } else {
                        b.classList.add('btn-outline-primary');
                        b.setAttribute('data-sel', 0);
                    }
                    b.innerText = group;
                    b.setAttribute('data-group', group);
                    b.addEventListener('click', function (evt) {
                        let currentlySelected = mdq.isTruthy(this.getAttribute('data-sel'));
                        if (currentlySelected) {
                            // Can only deselect if there's more than one selected
                            let cnt = this.parentElement.querySelectorAll('button[data-sel="1"]').length;
                            if (cnt > 1) {
                                let idx = mdq.currentGroups.indexOf(this.getAttribute('data-group'));
                                if (idx >= 0) {
                                    mdq.currentGroups.splice(idx, 1);
                                }
                            } else {
                                return; // Can't deselect the only one selected, and don't want it to refresh
                            }
                        } else {
                            // Add it, doesn't matter how many are already selected
                            mdq.currentGroups.push(this.getAttribute('data-group'));
                        }
                        mdq.init(mdq.config);
                    });
                    groupButtons.appendChild(b);
                });
            } else {
                // Checkboxes
                console.error('not implemented');
            }
            wrapper.appendChild(groupButtons);
        }

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
        for (const url of this.allQuestions) {
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

    /**
     * Returns true if the value is "truthy"
     * @param {*} val 
     */
    isTruthy: function (val) {
        val = val | false;

        if (typeof val === 'string') {
            val = val.toLowerCase();
        }
        if (val == true || val == 'true' || val == '1') {
            return true;
        }
        return false;
    },

    hasGroups: function () {
        return typeof mdq.config.questions === 'object';
    },

    /**
     * Returns the names of groups, or an empty array if there are no groups
     */
    groupList: function () {
        if (!mdq.hasGroups()) {
            return [];
        }
        return Object.keys(mdq.config.questions);
    }
};/**
 * Functions for dealing with the CSS that this script uses
 */
var mdqCSS = {
    cssContents: `div.mdq-wrap .mdq-question{margin-bottom:48px;padding-top:16px;border-top:1px solid silver}div.mdq-wrap .mdq-question:first-child{border-top:none}div.mdq-wrap .mdq-question input.correct,div.mdq-wrap .mdq-question select.correct{background-color:#ccffcc !important}div.mdq-wrap .mdq-question input.incorrect,div.mdq-wrap .mdq-question select.incorrect{background-color:#ffc2b3 !important}div.mdq-wrap .mdq-mc-grid{display:grid;grid-template-columns:min-content 1fr;cursor:pointer;padding-top:16px}div.mdq-wrap .mdq-mc-grid>div{padding-right:16px}div.mdq-wrap .mdq-mc-grid>div.sel{background:#eee}div.mdq-wrap .mdq-mc-grid>div.correct{background:#ccffcc}div.mdq-wrap .mdq-mc-grid>div.incorrect{background:#ffc2b3}div.mdq-wrap .mdq-buttons button{margin-right:16px;margin-top:16px}div.mdq-wrap .mdq-explanation{margin-top:16px}div.mdq-wrap .form-select,div.mdq-wrap .form-control{width:auto;display:inline !important}div.mdq-wrap .mdq-tf-result{margin-left:16px}div.mdq-wrap .mdq-tf-result.correct{color:green}div.mdq-wrap .mdq-tf-result.incorrect{color:red}div.mdq-wrap .mdq-credit{padding-top:32px;padding-bottom:16px}div.mdq-wrap .mdq-credit a{text-decoration:none}div.mdq-wrap .mdq-credit a:hover{text-decoration:underline}div.mdq-wrap .mdq-reload{margin-top:16px;margin-bottom:16px}
`,
};

/**
 * Functions that are specific to question types or involve
 * grading. 
 */
var mdqQuestions = {

    /**
     * Converts the array of possible answers to the HTML element
     * needed to display on screen
     * @param {*} question 
     */
    mcHTML: function (question) {

        let answers = question.sections.answers.split(/---[\t ]*\r?\n/);
        let correct = question.frontMatter.answer ?? '1'; // default to first
        if (correct.match(/^[A-Za-z]{1}$/)) {
            // Letter, convert it to a number
            correct = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(correct.toUpperCase()) + 1;
        } else if (!correct.match(/^\d+?$/)) {
            // Not a number, need an error message
            console.error('Could not determine correct answer for question');
            return;
        }

        let div = document.createElement('div');
        div.setAttribute('class', 'mdq-mc-grid');
        div.setAttribute('data-hash', question.hash);

        // Putting this into an array so we can shuffle later if needed
        let answerDivs = [];
        let idx = 1; // Track for correct answer
        answers.forEach(ans => {
            let divCheck = document.createElement('div');
            divCheck.setAttribute('data-row', idx);
            divCheck.setAttribute('data-hash', question.hash);
            divCheck.setAttribute('data-col', 0);
            let radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'ans-' + question.hash;
            radio.setAttribute('data-row', idx);
            radio.setAttribute('data-hash', question.hash);
            radio.setAttribute('data-c', idx == correct ? 1 : 0);

            divCheck.appendChild(radio);
            div.appendChild(divCheck);

            let divText = document.createElement('div');
            divText.setAttribute('data-row', idx);
            divText.setAttribute('data-hash', question.hash);
            divText.innerHTML = marked(ans);

            answerDivs.push([divCheck, divText]);
            idx++;
        });

        let shuffle = question.frontMatter.shuffle;
        if (shuffle === undefined || shuffle.match(/^t.*/i) || shuffle == 1) {
            answerDivs = mdq.shuffle(answerDivs);
        }

        answerDivs.forEach(el => {
            div.appendChild(el[0]);
            div.appendChild(el[1]);
        });

        return div;
    },

    /**
     * Returns the element to insert after a question for a true / false
     * question. 
     * 
     * @param {*} question 
     */
    tfHTML: function (question) {
        let answer = question.frontMatter.answer ?? 't';
        answer = answer.match(/^f.*/i) ? 'F' : 'T'; // Unless specifically false, it's true

        let div = document.createElement('div');
        let sel = document.createElement('select');
        sel.setAttribute('data-hash', question.hash);
        sel.setAttribute('data-c', answer);
        if (mdq.config.theme == 'bootstrap5') {
            sel.classList.add('form-select');
        }

        let optTrue = document.createElement('option');
        optTrue.innerHTML = mdq.config.lang.true;
        optTrue.value = 'T';
        sel.appendChild(optTrue);

        let optFalse = document.createElement('option');
        optFalse.innerHTML = mdq.config.lang.false;
        optFalse.value = 'F';
        sel.appendChild(optFalse);

        // Start without either selected
        sel.value = -1;

        sel.addEventListener('change', (evt) => {
            document.querySelector('button[data-hash="' + question.hash + '"][data-type="TF"]').disabled = false;
            document.querySelector('span[data-result][data-hash="' + question.hash + '"]').innerHTML = '';
        });
        div.appendChild(sel);

        let resultSpan = document.createElement('span');
        resultSpan.classList.add('mdq-tf-result');
        resultSpan.setAttribute('data-hash', question.hash);
        resultSpan.setAttribute('data-result', 1);
        resultSpan.innerHTML = '';
        div.appendChild(resultSpan);

        return div;
    },

    /**
     * Highlight the row and select the radio button when a multiple choice grid
     * element is clicked. 
     * 
     * @param {*} evt  
     */
    highlightMC: function (evt) {
        let parent = evt.target.closest('[data-row]');
        let hash = parent.getAttribute('data-hash');
        let row = parent.getAttribute('data-row');

        // Pick the radio button
        let radio = document.querySelector('[data-row="' + row + '"][data-hash="' + hash + '"] > input').checked = true;

        // Clear all styles - correct, incorrect, selected
        let gridDivs = document.querySelectorAll('.mdq-mc-grid[data-hash="' + hash + '"] > div');
        gridDivs.forEach(el => {
            el.classList.remove('sel', 'correct', 'incorrect');
        });

        // Add selected style to the correct row
        let selDivs = document.querySelectorAll('.mdq-mc-grid > div[data-row="' + row + '"][data-hash="' + hash + '"]');
        selDivs.forEach(el => {
            el.classList.add('sel');
        });

        // Enable the check button
        document.querySelector('button[data-hash="' + hash + '"]').disabled = false;
    },

    /**
     * Checks a question and displays the result.
     * 
     * This should hand off to separate functions, by question type, to
     * actually handle the checking. 
     * 
     * @param {*} hash 
     */
    checkQuestion: function (hash) {
        let question = mdqQuestions.getQuestion(hash);
        if (question === false) {
            console.error('Question ' + hash + ' not found');
            return;
        }

        if (mdq.isMultipleChoice(question)) {
            mdqQuestions.checkMCQuestion(question);
        } else if (mdq.isTrueFalse(question)) {
            mdqQuestions.checkTFQuestion(question);
        } else if (mdq.isFIB(question)) {
            mdqQuestions.checkFIBQuestion(question);
        } else {
            console.error('Only MC/TF/FIB checking is implemented for now');
            return;
        }

        // Enable the help button, if it's there
        let helpButton = document.querySelector('button[data-help][data-hash="' + question.hash + '"]');
        if (helpButton) {
            helpButton.disabled = false;
        }
    },

    /**
     * Check a fill in the blank question
     * @param {*} question    
     */
    checkFIBQuestion: function (question) {
        let inputs = document.querySelectorAll('div.mdq-question[data-hash="' + question.hash + '"] input');
        inputs.forEach(el => {
            el.classList.remove('correct', 'incorrect');

            if (el.value != '') {
                // Don't add classes if there's not a value
                let json = JSON.parse(el.getAttribute('data-opts'));
                let correct = false;

                if (mdq.isTruthy(json.contains)) {
                    if (!mdq.isTruthy(json.caseSensitive)) {
                        correct = el.value.toLowerCase().indexOf(el.getAttribute('data-c').toLowerCase()) > -1;
                    } else {
                        correct = el.value.indexOf(el.getAttribute('data-c')) > -1;
                    }
                }
                else if (mdq.isTruthy(json.regex)) {
                    let regexString = el.getAttribute('data-c');

                    // Get flags, if they're there
                    let flags = '';
                    let flagMatch = regexString.match(/\/([gimy]*)$/);
                    if (flagMatch) {
                        flags = flagMatch[1];
                    }
                    // Clear off regex delimiters
                    regexString = regexString.replace(/^\//, '').replace(/\/[gimy]*$/, '');

                    let regex = new RegExp(regexString, flags);
                    //regex = regex.replace(/^\//, '').replace(/\/$/, '');
                    correct = !!el.value.match(regex);
                } else {
                    if (mdq.isTruthy(json.caseSensitive)) {
                        correct = el.value == mdq.decodeEntities(el.getAttribute('data-c'));
                    } else {
                        correct = el.value.toLowerCase() == mdq.decodeEntities(el.getAttribute('data-c')).toLowerCase();
                    }
                }

                if (correct) {
                    el.classList.add('correct');
                } else {
                    el.classList.add('incorrect');
                }
            }
        });
        let selects = document.querySelectorAll('div.mdq-question[data-hash="' + question.hash + '"] select');
        selects.forEach(el => {
            el.classList.remove('correct', 'incorrect');
            var selected = el.options[el.selectedIndex];
            if (selected) {
                if (selected.getAttribute('data-c') == '1') {
                    el.classList.add('correct');
                } else {
                    el.classList.add('incorrect');
                }
            }
        });
    },

    /**
     * Checks a TF question
     * 
     * @param {*} question 
     */
    checkTFQuestion: function (question) {
        // Clear out the results span in case this isn't the first time
        let resultSpan = document.querySelector('span[data-result][data-hash="' + question.hash + '"]');
        resultSpan.classList.remove('correct', 'incorrect');
        resultSpan.innerHTML = '';

        let sel = document.querySelector('select[data-hash="' + question.hash + '"]');
        if (sel.value == sel.getAttribute('data-c')) {
            // Correct
            resultSpan.classList.add('correct');
            resultSpan.innerHTML = mdq.config.lang.correct;
        } else {
            // Incorrect
            resultSpan.classList.add('incorrect');
            resultSpan.innerHTML = mdq.config.lang.incorrect;
        }
    },

    /**
     * Check a multiple choice question 
     * 
     * @param {*} question 
     */
    checkMCQuestion: function (question) {
        // Clear styles from the rows
        let divs = document.querySelectorAll('div.mdq-mc-grid[data-hash="' + question.hash + '"] > div');
        divs.forEach(el => {
            el.classList.remove('sel', 'correct', 'incorrect');
        });
        let selRadio = document.querySelector('input[name=ans-' + question.hash + ']:checked');
        let correct = selRadio.getAttribute('data-c') == 1;
        let rowDivs = document.querySelectorAll('div.mdq-mc-grid[data-hash="' + selRadio.getAttribute('data-hash') + '"] > div[data-row="' + selRadio.getAttribute('data-row') + '"][data-hash="' + selRadio.getAttribute('data-hash') + '"]');

        rowDivs.forEach(el => {
            el.classList.add(correct ? 'correct' : 'incorrect');
        });

    },

    /**
     * Returns the question with a specific hash, or false if it's not found
     * @param {*} hash 
     */
    getQuestion: function (hash) {
        for (const q of mdq.loadedQuestions) {
            if (q.hash == hash) {
                return q;
            }
        }
        return false;
    },

    parseFields: function (md, question) {
        // Text input fields 
        md = md.replace(/___\((.*?)\)\[(.*?)\]/g, (match, correct, opts) => {
            opts = mdqQuestions.fibParseOptions(opts);

            let input = document.createElement('input');
            input.setAttribute('data-hash', question.hash);
            input.setAttribute('data-c', correct);
            if (mdq.config.theme == 'bootstrap5') {
                input.classList.add('form-control');
            }
            if (opts.width !== undefined) {
                input.style.width = opts.width;
            }

            input.setAttribute('data-opts', JSON.stringify(opts));

            return input.outerHTML;
        });

        // Dropdowns
        md = md.replace(/___{(.*?)}\[(.*?)]/g, (match, values, opts) => {
            opts = mdqQuestions.fibParseOptions(opts);

            let sel = document.createElement('select');
            sel.setAttribute('data-hash', question.hash);
            if (mdq.config.theme == 'bootstrap5') {
                sel.classList.add('form-select');
            }

            let valRay = values.split(/\s*?\|\s*?/);
            let optRay = []; // Put into array so we can shuffle if requested
            valRay.forEach(el => {
                let isCorrect = !!el.match(/^\+:/);
                el = el.replace(/^(\+|\-):/, '');

                let newOpt = document.createElement('option');
                newOpt.setAttribute('data-c', isCorrect ? 1 : 0);
                newOpt.value = el;
                newOpt.innerHTML = el;
                optRay.push(newOpt);
            });

            if (opts.shuffle && (opts.shuffle == '1' || opts.shuffle.match(/^(t|y)/i))) {
                optRay = mdq.shuffle(optRay);
            }

            optRay.forEach(opt => {
                sel.appendChild(opt);
            });

            return sel.outerHTML;
        });
        return md;
    },

    /**
     * Parse the matched options string into a dictionary
     * @param {*} optsString 
     */
    fibParseOptions: function (optsString) {
        let opts = optsString.split(/\s*?,\s*?/);
        let optDictionary = {};
        opts.forEach(opt => {
            let split = opt.split(/\s*?:\s*?/);
            if (split[0] !== undefined && split[1] !== undefined) {
                optDictionary[mdq.toCamelCase(split[0].trim())] = split[1].trim();
            }
        });
        return optDictionary;
    },

    /**
     * Return true if this question needs mermaid.
     * 
     * Identify by finding ```mermad somewhere in either the question
     * text or the explanation. 
     * @param {*} question 
     */
    needsMermaid: function (question) {
        return !!question.rawContent.match(/```mermaid/s);
    },

    needsMathJax: function (question) {
        return !!(question.rawContent.match(/\$\$(.*?)\$\$/s) || question.rawContent.match(/\\\(.*?\)\\/s))
    },

    needsPrism: function (question) {
        let matches = question.rawContent.match(/```([A-Za-z0-9]+)/sg);
        let need = false;
        if (!matches) {
            return false;
        }
        matches.forEach(el => {
            if (el != '```mermaid') {
                need = true;
            }
        });
        return need;
    }

}