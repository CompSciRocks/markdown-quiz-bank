

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