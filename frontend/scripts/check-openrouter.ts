async function checkOpenRouter(){
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error("OPENROUTER_API_KEY is not set in the environment variables.");
        process.exitCode = 1;
        return;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/key', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(10000) // 10 seconds timeout

        });
        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);

    } catch (error) {
        console.error("Error occurred while checking OpenRouter API:", error);
        process.exitCode = 1;
    }
}

checkOpenRouter();
