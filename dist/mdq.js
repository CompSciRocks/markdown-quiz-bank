/**
 * Main script for Markdown Question Quiz. This hands off to other files
 * as needed for actually handling the grading and layout. 
 */
var mdq = {

    /**
     * URLs to use for loading external JS libraries, most likely
     * from a CDN. These will be loaded as needed depeding on the
     * content of the questions. 
     */
    path: {
        'bootstrap5': 'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css',
        'marked': 'https://cdnjs.cloudflare.com/ajax/libs/marked/3.0.7/marked.min.js',
        'mathjax': '',
        'mermaid': '',
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
            }, questions: [],
            theme: '',
            css: true,
        };
        this.config = { ...def, ...config };

        // Shuffle the questions
        for (let i = this.config.questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this.config.questions[i];
            this.config.questions[i] = this.config.questions[j];
            this.config.questions[j] = temp;
        }

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
        if (currentScript.endsWith('.js')) {
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

        // @TODO Add others eventually, will require looking at content of questions

        return scripts;
    },

    /**
     * Take the loaded questions and build the HTML for the page
     */
    buildPage: function () {

        // Add the MDQ CSS if requested
        if (mdq.config.css) {
            var s = document.createElement('style');
            s.setAttribute('type', 'text/css');
            s.appendChild(document.createTextNode(mdqCSS.cssContents));
            document.head.appendChild(s);
        }

        var wrapper = document.createElement("div");
        wrapper.setAttribute('class', 'mdq-wrap ' + (mdq.config.theme == 'bootstrap5' ? 'container' : ''));
        mdq.loadedQuestions.forEach(question => {
            wrapper.appendChild(mdq.questionElement(question));
        });

        if (mdq.config.parent == '') {
            document.body.appendChild(wrapper);
        } else {
            document.getElementById(mdq.config.parent).appendChild(wrapper);
        }
    },


    /**
     * Returns a div element for an individual question
     * @param {*} question 
     */
    questionElement: function (question) {
        var div = document.createElement('div');
        div.setAttribute('class', 'mdq-question');
        div.setAttribute('id', question.hash);

        let divContent = document.createElement('div');
        divContent.setAttribute('class', 'md-question-body');
        divContent.innerHTML = mdq.formatQuestion(question.markdown);

        div.appendChild(divContent);

        let qType = '';
        if (mdq.isMultipleChoice(question)) {
            let divMC = mdqQuestions.mcHTML(question);
            divMC.addEventListener('click', (evt) => {
                mdqQuestions.highlightMC(evt);
            });
            div.appendChild(divMC);
            qType = 'MC';
        }

        let divButtons = document.createElement('div');
        divButtons.setAttribute('class', 'mdq-buttons');
        let btnCheck = document.createElement('button');
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
     * @param {*} questionText 
     */
    formatQuestion: function (questionText) {
        return marked(questionText);
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
                this.loadedQuestions.push(this.fileInfo(data));
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
    fileInfo: function (fileContent) {
        fileContent = fileContent.trim();
        let ret = {};
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
    }
};/**
 * Functions for dealing with the CSS that this script uses
 */
var mdqCSS = {
    cssContents: `div.mdq-wrap .mdq-question{margin-bottom:48px;padding-top:16px;border-top:1px solid silver}div.mdq-wrap .mdq-question:first-child{border-top:none}div.mdq-wrap .mdq-mc-grid{display:grid;grid-template-columns:min-content 1fr;cursor:pointer;padding-top:16px}div.mdq-wrap .mdq-mc-grid>div{padding-right:16px}div.mdq-wrap .mdq-mc-grid>div.sel{background:#eee}div.mdq-wrap .mdq-mc-grid>div.correct{background:#ccffcc}div.mdq-wrap .mdq-mc-grid>div.incorrect{background:#ffc2b3}div.mdq-wrap .mdq-buttons button{margin-right:16px;margin-top:16px}div.mdq-wrap .mdq-explanation{margin-top:16px}
`,
};/**
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
        let correct = question.frontMatter.answer ?? 1; // default to first
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
        } else {
            console.error('Only MC checking is implemented for now');
            return;
        }

        // Enable the help button, if it's there
        let helpButton = document.querySelector('button[data-help][data-hash="' + question.hash + '"]');
        if (helpButton) {
            helpButton.disabled = false;
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
    }
}