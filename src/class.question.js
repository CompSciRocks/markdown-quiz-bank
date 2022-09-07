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

        // Strip out the {% raw %} tags. They're not needed for this script.
        fileContents = fileContents.replace(/^\s*{%\s*raw\s*%}\s*/, '');
        fileContents = fileContents.replace(/\s*{%\s*endraw\s*%}\s*$/, '');

        // Need a randomish identifier for later
        this.hash = Math.random().toString(36).substring(2);

        let fmMatch = fileContents.match(/^\s*?---\s*?(.*?)---/s);
        this.properties = fmMatch ? this.parseFrontMatter(fmMatch[1]) : {};

        // Remove front matter
        fileContents = fileContents.replace(/^\s*?---\s*?(.*?)---/s, '').trim();

        // Split on the section headers
        // let sections = fileContents.split(/---[\t ]*?([A-Za-z ]+)/g);
        let sections = fileContents.split(/---([A-Za-z]+)/g);

        this.markdown = sections.shift().trim();

        if (this.isFIB()) {
            // Base64 the correct answer so it doesn't get messed up by escaping
            this.markdown = this._encodeFIB(this.markdown);
        }

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
            parsed = this._formatFIB(parsed);
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
        div.classList.add('mdq-question-wrap');

        let divContent = document.createElement('div');
        divContent.classList.add('mdq-question');
        divContent.setAttribute('data-hash', this.hash);
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
            // Not pulling another method to build the HTML for this, since
            // the blanks are embedded in the question. Just needs to add
            // event handlers to the elements. 
            qType = 'FIB';
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
     * Set the event handlers on the FIB question so that it'll work.
     * 
     * This is done differently than the MC and TF since FIB blanks and
     * dropdowns are in the question body instead of after the question
     * text. 
     */
    _setupFIB(contentDiv) {
        let blanks = contentDiv.querySelectorAll('input[type="text"][data-type="fib"]');
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

    /**
     * Parse the matched options string into a dictionary  
     * @param {*} optString 
     * @returns 
     */
    _parseFIBOptions(optsString) {
        let opts = optsString.split(/\s*?,\s*?/);
        let optDictionary = {};
        opts.forEach(opt => {
            let split = opt.split(/\s*?:\s*?/);
            if (split[0] !== undefined && split[1] !== undefined) {
                optDictionary[MDQ.toCamelCase(split[0].trim())] = split[1].trim();
            }
        });
        return optDictionary;
    }

    /**
     * Base64 encode the correct answer in FIB questions so that it doesn't potentially cause
     * issues when running through marked. 
     */
    _encodeFIB(content) {
        content = content.replace(/___\((.*?)\)\[(.*?)\]/g, (match, correct, opts) => {
            return '___(' + btoa(correct) + ')[' + opts + ']';
        });
        return content;
    }

    /**
     * Convert the FIB placeholders into text inputs or
     * dropdowns. 
     * 
     * @param {*} content 
     */
    _formatFIB(content) {
        // Text input fields 
        content = content.replace(/___\((.*?)\)\[(.*?)\]/g, (match, correct, opts) => {
            opts = this._parseFIBOptions(opts);
            let input = document.createElement('input');
            input.setAttribute('data-type', 'fib');
            input.setAttribute('data-hash', this.hash);
            input.setAttribute('data-c', correct);
            if (this.useBootstrap()) {
                input.classList.add('form-control');
            }
            if (opts.width !== undefined) {
                input.style.width = opts.width;
            }

            input.setAttribute('data-opts', JSON.stringify(opts));

            return input.outerHTML;
        });

        // Dropdowns
        content = content.replace(/___{(.*?)}\[(.*?)]/g, (match, values, opts) => {
            opts = this._parseFIBOptions(opts);

            let sel = document.createElement('select');
            sel.setAttribute('data-hash', this.hash);
            sel.setAttribute('data-type', 'sel');
            if (this.useBootstrap()) {
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
        return content;
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
        let questionDiv = document.querySelector('div.mdq-question[data-hash="' + this.hash + '"]');
        questionDiv.querySelectorAll('input[data-type="fib"]').forEach(input => {
            input.classList.remove('correct', 'incorrect');
            let val = MDQ.decodeEntities(input.value.trim());

            if (val != '') {
                // We only care if there's actually a value
                let json = JSON.parse(input.getAttribute('data-opts'));
                let correct = false;
                let correctValue = atob(input.getAttribute('data-c'));
                if (MDQ.isTruthy(json.contains)) {
                    // Correct if it contains the key value
                    if (!MDQ.isTruthy(json.caseSensitive)) {
                        correct = val.toLowerCase().indexOf(correctValue.toLowerCase()) > -1;
                    } else {
                        correct = val.indexOf(correctValue) > -1;
                    }
                } else if (MDQ.isTruthy(json.regex)) {
                    // Use regex
                    let flags = '';
                    let flagMatch = correctValue.replace(/^\//, '').match(/\/([gimy]*)$/);
                    if (flagMatch) {
                        flags = flagMatch[1];
                    }
                    // Clear off regex delimiters
                    let regexString = correctValue.replace(/^\//, '').replace(/\/[gimy]*$/, '');
                    let regex = new RegExp(regexString, flags);
                    correct = !!val.match(regex);
                } else {
                    // Generic match
                    if (MDQ.isTruthy(json.caseSensitive)) {
                        correct = val == correctValue;
                    } else {
                        correct = val.toLowerCase() == correctValue.toLowerCase();
                    }
                }

                input.classList.add(correct ? 'correct' : 'incorrect');
            }
        });
        questionDiv.querySelectorAll('select[data-type="sel"]').forEach(input => {
            input.classList.remove('correct', 'incorrect');
            let selIndex = input.selectedIndex;
            if (selIndex >= 0) {
                // Only worry if they've actually selected something
                let sel = input.options[selIndex];
                input.classList.add(sel.getAttribute('data-c') == 1 ? 'correct' : 'incorrect');
            }
        });
    }

    /**
     * Is this tagged as a multiple choice question in front matter
     */
    isMC() {
        // Multiple choice is default if it's left off
        return this.getProperty('type', 'mc').toLowerCase() == 'mc';
    }

    /**
     * Is this tagged as a true / false question in front matter
     */
    isTF() {
        return this.getProperty('type', '').toLowerCase() == 'tf';
    }

    /**
     * Is this tagged as a fill in the blank question in the front matter
     */
    isFIB() {
        return this.getProperty('type', '').toLowerCase() == 'fib';
    }

    useBootstrap() {
        return this.config.theme == 'bootstrap5';
    }

    /**
     * Get a specific property from the front matter
     * @param {*} property 
     */
    getProperty(property, defaultValue) {
        return this.properties[property] ?? defaultValue;
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