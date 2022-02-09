import axios from 'axios'
import { useState } from 'react'

const StartShowButton = () => {

    const [ isDisabled, setIsDisabled ] = useState(false)

    const handleClick = async () => {
        setIsDisabled(true)
        const response = await axios.get('https://us-central1-ktxt-firebase.cloudfunctions.net/startShow');
        console.log('firebase function response', response);
        setIsDisabled(false)
    }

    return (
        <button disabled={isDisabled} onClick={() => handleClick()}>
            Start Show
        </button>
    )
}

export default StartShowButton