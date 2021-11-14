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
        return `div.mdq-wrap .mdq-question-groups{margin-top:16px;margin-bottom:8px}div.mdq-wrap .mdq-question-groups label{padding-right:16px;margin-bottom:8px}div.mdq-wrap .mdq-question-groups input[type="checkbox"]{margin-right:8px}div.mdq-wrap .mdq-question{margin-bottom:48px;padding-top:16px;border-top:1px solid silver}div.mdq-wrap .mdq-question:first-child{border-top:none}div.mdq-wrap .mdq-question input.correct,div.mdq-wrap .mdq-question select.correct{background-color:#ccffcc !important}div.mdq-wrap .mdq-question input.incorrect,div.mdq-wrap .mdq-question select.incorrect{background-color:#ffc2b3 !important}div.mdq-wrap .mdq-mc-grid{display:grid;grid-template-columns:min-content 1fr;cursor:pointer;padding-top:16px}div.mdq-wrap .mdq-mc-grid>div{padding-right:16px}div.mdq-wrap .mdq-mc-grid>div.sel{background:#eee}div.mdq-wrap .mdq-mc-grid>div.correct{background:#ccffcc}div.mdq-wrap .mdq-mc-grid>div.incorrect{background:#ffc2b3}div.mdq-wrap .mdq-buttons button{margin-right:16px;margin-top:16px}div.mdq-wrap .mdq-explanation{margin-top:16px}div.mdq-wrap .form-select,div.mdq-wrap .form-control{width:auto;display:inline !important}div.mdq-wrap .mdq-tf-result{margin-left:16px}div.mdq-wrap .mdq-tf-result.correct{color:green}div.mdq-wrap .mdq-tf-result.incorrect{color:red}div.mdq-wrap .mdq-credit{padding-top:32px;padding-bottom:16px}div.mdq-wrap .mdq-credit a{text-decoration:none}div.mdq-wrap .mdq-credit a:hover{text-decoration:underline}div.mdq-wrap .mdq-reload{margin-top:16px;margin-bottom:16px}
`;
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
};/**
 * Container for a single question that's been loaded 
 */
class MDQQuestion {

    /**
     * Full contents of the file 
     */
    rawContent = "";

    /**
     * Front Matter properties, converted to camelCase
     */
    properties = {};

    /**
     * URL of the file. Need this for the comments.
     */
    url = "";

    /**
     * Config object for the quiz instance. Needed for some of
     * the formatting. 
     */
    config = {};

    /**
     * @param {*} fileContents  Raw contents from the file
     */
    constructor(fileContents, url, config) {
        this.rawContent = fileContents;
        this.url = url;
        this.config = config;

        // Need a randomish identifier for later
        this.hash = Math.random().toString(36).slice(-10);

        let fmMatch = fileContents.match(/^\s*?---\s*?(.*?)---/s);
        this.properties = fmMatch ? this.parseFrontMatter(fmMatch[1]) : {};

        // Remove front matter
        fileContents = fileContents.replace(/^\s*?---\s*?(.*?)---/s, '').trim();

        // Split on the section headers
        let sections = fileContents.split(/---[\t ]*?([A-Za-z ]+)/g);
        this.markdown = sections.shift().trim();

        this.sections = {};
        for (let i = 0; i < sections.length - 1; i += 2) {
            this.sections[MDQ.toCamelCase(sections[i].trim())] = sections[i + 1].trim();
        }
    }


    /**
     * Parse the markdown to HTML. Marked will be doing most
     * of the work, but we'll hand off as needed for custom 
     * stuff. 
     * 
     * @param {*} question
     */
    formatted() {
        let parsed = marked(this.markdown);
        if (this.isFIB()) {
            console.error('Need to parse FIB fields');
            // parsed = mdqQuestions.parseFields(parsed, question);
        }
        return parsed;
    }

    /**
     * Returns a DOM element that can be inserted into the page
     * @param {*} theme 
     */
    element() {

        let div = document.createElement('div');
        div.setAttribute('data-hash', this.hash);

        let divContent = document.createElement('div');
        divContent.innerHTML = this.formatted();
        div.appendChild(divContent);

        let qType = '';
        if (this.isMC()) {
            div.appendChild(this._elementMC());
            qType = 'MC';
        } else if (this.isTF()) {
            div.appendChild(this._elementTF());
            qType = 'TF';
        } else if (this.isFIB()) {
            return this._elementFIB();
        } else {
            throw new Error("Unknown question type");
        }

        // Check and explain, if enabled, buttons
        let divButtons = document.createElement('div');
        divButtons.classList.add('mdq-buttons');
        let btnCheck = document.createElement('button');
        if (this.useBootstrap()) {
            btnCheck.classList.add('btn', 'btn-primary');
        }
        btnCheck.setAttribute('data-hash', this.hash);
        btnCheck.setAttribute('data-type', qType);
        btnCheck.setAttribute('disabled', true);
        btnCheck.addEventListener('click', (evt) => {
            this.checkAnswer();
        });
        btnCheck.innerHTML = this.config.lang.check + '...';
        divButtons.appendChild(btnCheck);

        if (this.sections.explanation !== undefined) {
            let btnExplain = document.createElement('button');
            btnExplain.setAttribute('disabled', true);
            btnExplain.setAttribute('data-help', 1);
            btnExplain.setAttribute('data-hash', this.hash);
            if (this.useBootstrap()) {
                btnExplain.classList.add('btn', 'btn-secondary');
            }
            btnExplain.addEventListener('click', (evt) => {
                let elExplain = document.querySelector('div.mdq-explanation[data-hash="' + this.hash + '"]');
                if (elExplain) {
                    elExplain.style.display = 'block';
                }
            });
            btnExplain.innerHTML = this.config.lang.help + '...';
            divButtons.appendChild(btnExplain);
        }
        div.appendChild(divButtons);

        if (this.sections.explanation !== undefined) {
            let divExplanation = document.createElement('div');
            divExplanation.setAttribute('class', 'mdq-explanation');
            divExplanation.setAttribute('data-hash', this.hash);
            divExplanation.style.display = 'none';
            divExplanation.innerHTML = marked(this.sections.explanation);
            div.appendChild(divExplanation);
        }

        return div;

    }

    /**
     * Returns the multiple choice answers as a dom element to 
     * append in the element function. 
     * 
     * @returns 
     */
    _elementMC() {
        let answers = this.sections.answers.split(/---[\t ]*\r?\n/);
        let correct = this.getProperty('answer') ?? '1'; // default to first
        if (correct.match(/^[A-Za-z]{1}$/)) {
            // Letter, convert it to a number
            correct = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(correct.toUpperCase()) + 1;
        } else if (!correct.match(/^\d+?$/)) {
            // Not a number, need an error message
            console.error('Could not determine correct answer for question');
            return;
        }
        let div = document.createElement('div');
        div.setAttribute('data-hash', this.hash);

        let answersDiv = document.createElement('div');
        answersDiv.classList.add('mdq-mc-grid');
        answersDiv.setAttribute('data-hash', this.hash);
        // Putting this into an array so we can shuffle later if needed
        let answerDivs = [];
        let idx = 1; // Track for correct answer
        answers.forEach(ans => {
            let divCheck = document.createElement('div');
            divCheck.setAttribute('data-row', idx);
            divCheck.setAttribute('data-hash', this.hash);
            divCheck.setAttribute('data-col', 0);
            let radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'ans-' + this.hash;
            radio.setAttribute('data-row', idx);
            radio.setAttribute('data-hash', this.hash);
            radio.setAttribute('data-c', idx == correct ? 1 : 0);

            divCheck.appendChild(radio);
            div.appendChild(divCheck);

            let divText = document.createElement('div');
            divText.setAttribute('data-row', idx);
            divText.setAttribute('data-hash', this.hash);
            divText.innerHTML = marked(ans);

            answerDivs.push([divCheck, divText]);
            idx++;
        });

        let shuffle = this.getProperty('shuffle');
        if (shuffle === undefined || shuffle.match(/^t.*/i) || shuffle == 1) {
            answerDivs = MDQ.shuffle(answerDivs);
        }

        answerDivs.forEach(el => {
            answersDiv.appendChild(el[0]);
            answersDiv.appendChild(el[1]);
        });

        answersDiv.addEventListener('click', evt => {
            let parent = evt.target.closest('[data-row]');
            let hash = parent.getAttribute('data-hash');
            let row = parent.getAttribute('data-row');

            // Pick the radio button
            let radio = document.querySelector('[data-row="' + row + '"][data-hash="' + hash + '"] > input');
            radio.checked = true;

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

        });

        div.appendChild(answersDiv);

        return div;
    }

    _elementTF() {
        let answer = this.getProperty('answer') ?? 't';
        answer = answer.match(/^f.*/i) ? 'F' : 'T'; // Unless specifically false, it's true

        let div = document.createElement('div');
        let sel = document.createElement('select');
        sel.setAttribute('data-hash', this.hash);
        sel.setAttribute('data-c', answer);
        if (this.useBootstrap()) {
            sel.classList.add('form-select');
        }

        let optTrue = document.createElement('option');
        optTrue.innerHTML = this.config.lang.true;
        optTrue.value = 'T';
        sel.appendChild(optTrue);

        let optFalse = document.createElement('option');
        optFalse.innerHTML = this.config.lang.false;
        optFalse.value = 'F';
        sel.appendChild(optFalse);

        // Start without either selected
        sel.value = -1;

        sel.addEventListener('change', (evt) => {
            document.querySelector('button[data-hash="' + this.hash + '"][data-type="TF"]').disabled = false;
            document.querySelector('span[data-result][data-hash="' + this.hash + '"]').innerHTML = '';
        });
        div.appendChild(sel);

        let resultSpan = document.createElement('span');
        resultSpan.classList.add('mdq-tf-result');
        resultSpan.setAttribute('data-hash', this.hash);
        resultSpan.setAttribute('data-result', 1);
        resultSpan.innerHTML = '';
        div.appendChild(resultSpan);

        return div;
    }

    _elementFIB() {
        console.info('building FIB');
    }

    checkAnswer() {
        if (this.isMC()) {
            this._checkAnswerMC();
        } else if (this.isTF()) {
            this._checkAnswerTF();
        } else if (this.isFIB()) {
            this._checkAnswerFIB();
        }
        // Enable the help button, if it's there
        let helpButton = document.querySelector('button[data-help][data-hash="' + this.hash + '"]');
        if (helpButton) {
            helpButton.disabled = false;
        }
    }

    /**
     * Check a multiple choice question
     */
    _checkAnswerMC() {
        // Clear styles
        let divs = document.querySelectorAll('div.mdq-mc-grid[data-hash="' + this.hash + '"] > div');
        divs.forEach(div => {
            div.classList.remove('sel', 'correct', 'incorrect');
        });
        let selRadio = document.querySelector('input[name=ans-' + this.hash + ']:checked');
        let correct = selRadio.getAttribute('data-c') == 1;
        let rowDivs = document.querySelectorAll('div.mdq-mc-grid[data-hash="' + selRadio.getAttribute('data-hash') + '"] > div[data-row="' + selRadio.getAttribute('data-row') + '"][data-hash="' + selRadio.getAttribute('data-hash') + '"]');
        rowDivs.forEach(el => {
            el.classList.add(correct ? 'correct' : 'incorrect');
        });
    }

    _checkAnswerTF() {
        // Clear out the results span in case this isn't the first time
        let resultSpan = document.querySelector('span[data-result][data-hash="' + this.hash + '"]');
        resultSpan.classList.remove('correct', 'incorrect');
        resultSpan.innerHTML = '';

        let sel = document.querySelector('select[data-hash="' + this.hash + '"]');
        if (sel.value == sel.getAttribute('data-c')) {
            // Correct
            resultSpan.classList.add('correct');
            resultSpan.innerHTML = this.config.lang.correct;
        } else {
            // Incorrect
            resultSpan.classList.add('incorrect');
            resultSpan.innerHTML = this.config.lang.incorrect;
        }
    }

    _checkAnswerFIB() {

    }

    /**
     * Is this tagged as a multiple choice question in front matter
     */
    isMC() {
        return this.getProperty('type').toLowerCase() == 'mc';
    }

    /**
     * Is this tagged as a true / false question in front matter
     */
    isTF() {
        return this.getProperty('type').toLowerCase() == 'tf';
    }

    /**
     * Is this tagged as a fill in the blank question in the front matter
     */
    isFIB() {
        return this.getProperty('type').toLowerCase() == 'fib';
    }

    useBootstrap() {
        return this.config.theme == 'bootstrap5';
    }

    /**
     * Get a specific property from the front matter
     * @param {*} property 
     */
    getProperty(property) {
        return this.properties[property];
    }

    /**
     * Parse front matter into an object, with the header as key
     * @param {*} frontMatter 
     */
    parseFrontMatter(frontMatter) {
        let ret = {};
        let lines = frontMatter.split(/\n\r?/);
        lines.forEach(el => {
            el = el.trim();
            let sp = el.split(/\s*?:\s*?/);
            if (sp.length == 2) {
                ret[MDQ.toCamelCase(sp[0].trim())] = sp[1].trim();
            }
        });

        // Special case where either answer or ans is okay in the file, but the
        // script will always use answer. 
        if (typeof ret.answer === 'undefined' && typeof ret.ans !== 'undefined') {
            ret.answer = ret.ans;
        }

        return ret;
    }

    needsMathJax() {
        return !!(this.rawContent.match(/\$\$(.*?)\$\$/s) || this.rawContent.match(/\\\(.*?\)\\/s))
    }

    needsMermaid() {
        return !!this.rawContent.match(/```mermaid/s);
    }

    needsPrism() {
        let matches = this.rawContent.match(/```([A-Za-z0-9]+)/sg);
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