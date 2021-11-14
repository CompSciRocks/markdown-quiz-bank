/**
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
            return this._elementTF(theme);
        } else if (this.isFIB()) {
            return this._elementFIB(theme);
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