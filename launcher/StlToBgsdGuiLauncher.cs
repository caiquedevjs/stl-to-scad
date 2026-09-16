using System;
using System.Diagnostics;
using System.IO;

internal static class StlToBgsdGuiLauncher
{
    private static int Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string serverPath = Path.Combine(baseDir, "tools", "gui-server.js");

        if (!File.Exists(serverPath))
        {
            Console.Error.WriteLine("Nao encontrei o servidor da interface:");
            Console.Error.WriteLine(serverPath);
            Console.WriteLine();
            Console.WriteLine("Pressione Enter para fechar.");
            Console.ReadLine();
            return 1;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "node",
                Arguments = "\"" + serverPath.Replace("\"", "\\\"") + "\" --open",
                WorkingDirectory = baseDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            });
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Nao foi possivel iniciar a interface. Confirme se o Node.js esta no PATH.");
            Console.Error.WriteLine(ex.Message);
            Console.WriteLine();
            Console.WriteLine("Pressione Enter para fechar.");
            Console.ReadLine();
            return 1;
        }
    }
}
