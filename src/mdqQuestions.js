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