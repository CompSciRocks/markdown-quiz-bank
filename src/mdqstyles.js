let MDQ_Styles = {

    /**
     * Default styles. These are always applied, even if another
     * theme is selected. 
     */
    default: {
        select: {
            className: [],
            style: '',
            id: ''
        },
        button: {
            primary: {
                className: [],
                style: '',
                id: '',
            },
            secondary: {
                className: [],
                style: '',
                id: '',
            },
            group: {
                className: ['mdq-button-group'],
                style: '',
                id: '',
            },
        },
        wrap: {
            className: 'mdq-wrap',
            style: '',
            id: '',
        },
        input: {
            text: {},
            select: '',
            radio: '',
        }
    },

    bootstrap5: {
        select: 'form-select',
        button: {
            primary: 'btn btn-primary',
            secondary: 'btn btn-secondary',
            group: 'btn-group',
        },
        wrap: 'container',
        input: {
            text: 'form-control',
            select: 'form-control',
            radio: '',
        }
    }
}