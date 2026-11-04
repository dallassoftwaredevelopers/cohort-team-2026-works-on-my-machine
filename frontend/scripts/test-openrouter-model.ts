async function testOpenRouterModel(){
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error("OPENROUTER_API_KEY is not set in the environment variables.");
        process.exitCode = 1;
        return;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            signal: AbortSignal.timeout(30000), // 30 seconds timeout
            body: JSON.stringify({
                model: 'openai/gpt-4.1-mini',
                messages: [
                    { role: 'user', content: "You’re a raccoon caught inside a bank vault. Your team is called “Works on My Machine.” Explain to the security guard why you’re technically an unpaid intern. Your fictional crew consists of Tim, Josh, Amy, Cheryl, Eric, and Mandela. Assign each person an animal and give each a short, ridiculous excuse. Finish with the guard’s response." }
                ],
                max_tokens: 500,

            })
        });
        if (!response.ok) {
            console.error("Failed to get a response from OpenRouter API. Status:", response.status);
            process.exitCode = 1;
            return;
        }
        const result = await response.json();
        console.log(result.choices[0].message.content);
        console.log(result.usage);

        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);

    } catch (error) {
        console.error("Error occurred while checking OpenRouter API:", error);
        process.exitCode = 1;
    }
}

testOpenRouterModel()
